/**
 * Standalone dictionary lookup for the in-game definition popup.
 *
 * This mirrors the fetch/decompress/deinflect logic of routes/[word]/+page.ts
 * but is callable from anywhere (not a SvelteKit `load`): instead of throwing
 * `error()` / `redirect()`, it returns a discriminated result. The existing
 * [word] page is intentionally left untouched to avoid any regression to the
 * production dictionary route — a few lines of duplicated decompress logic is
 * a deliberate, low-risk trade.
 */
import { decompressSync, strFromU8 } from 'fflate';
import { getDictionaryUrl } from '$lib/shard-utils';
import { findWordsWithDeinflection } from '$lib/utils/search-navigation';
import type { DictionaryEntry } from '$lib/types';

export type LookupResult =
	| { status: 'ok'; word: string; data: DictionaryEntry }
	| { status: 'redirect'; to: string; from: string; conjugationInfo: string }
	| { status: 'notfound'; word: string };

/** A flattened, render-ready summary for one language, used by the compact card. */
export interface EntrySummary {
	lang: 'zh' | 'ja' | 'ko' | 'other';
	headword: string;
	reading?: string; // pinyin / kana / romanization
	definitions: string[];
}

function decompressAndParse(buf: ArrayBuffer): DictionaryEntry {
	return JSON.parse(strFromU8(decompressSync(new Uint8Array(buf)))) as DictionaryEntry;
}

/**
 * Look up a single word. Follows `redirect` entries and, on a miss, tries
 * deinflection (Japanese conjugation / Korean particles) — returning a
 * `redirect` result the caller can choose to follow.
 */
export async function lookupWord(
	word: string,
	fetchFn: typeof fetch = fetch,
	dev = false
): Promise<LookupResult> {
	const trimmed = word.trim();
	if (!trimmed) return { status: 'notfound', word };

	try {
		const url = await getDictionaryUrl(trimmed, dev, fetchFn);
		// External (GitHub raw) URLs: use global fetch to avoid SvelteKit's
		// wrapper, matching the [word] route's handling of binary payloads.
		const doFetch = url.startsWith('http') ? globalThis.fetch : fetchFn;
		const res = await doFetch(url);

		if (!res.ok) {
			const deinflection = await findWordsWithDeinflection(trimmed, fetchFn);
			if (deinflection?.primary) {
				return {
					status: 'redirect',
					to: deinflection.primary.dictionaryForm,
					from: trimmed,
					conjugationInfo: deinflection.primary.conjugationInfo
				};
			}
			return { status: 'notfound', word: trimmed };
		}

		let data = decompressAndParse(await res.arrayBuffer());

		// Follow a redirect entry to the canonical record.
		if (data.redirect) {
			const rUrl = await getDictionaryUrl(data.redirect, dev, fetchFn);
			const rFetch = rUrl.startsWith('http') ? globalThis.fetch : fetchFn;
			const rRes = await rFetch(rUrl);
			if (rRes.ok) data = decompressAndParse(await rRes.arrayBuffer());
		}

		return { status: 'ok', word: trimmed, data };
	} catch {
		return { status: 'notfound', word: trimmed };
	}
}

/**
 * Flatten a DictionaryEntry into a compact, render-ready summary, preferring
 * the game's current language but falling back to whatever the entry has.
 */
export function summarizeEntry(
	data: DictionaryEntry,
	prefer: 'zh' | 'ja' | 'ko' | 'tr'
): EntrySummary | null {
	const zh = () => {
		const w = data.chinese_words?.[0];
		if (!w) return null;
		const defs = w.items?.flatMap((i) => i.definitions ?? []).filter(Boolean) ?? [];
		const reading = w.items?.find((i) => i.pinyin)?.pinyin;
		return defs.length || w.gloss
			? ({
					lang: 'zh',
					headword: w.trad && w.trad !== w.simp ? `${w.simp} / ${w.trad}` : w.simp,
					reading,
					definitions: defs.length ? defs : w.gloss ? [w.gloss] : []
				} satisfies EntrySummary)
			: null;
	};

	const ja = () => {
		const w = data.japanese_words?.[0];
		if (!w) return null;
		const headword = w.kanji?.[0]?.text || w.kana?.[0]?.text;
		if (!headword) return null;
		const reading = w.kanji?.[0]?.text ? w.kana?.[0]?.text : undefined;
		const defs =
			w.sense
				?.flatMap((s) => s.gloss?.filter((g) => !g.lang || g.lang === 'eng').map((g) => g.text))
				.filter((d): d is string => Boolean(d)) ?? [];
		return defs.length
			? ({ lang: 'ja', headword, reading, definitions: defs } satisfies EntrySummary)
			: null;
	};

	const ko = () => {
		const w = data.korean_words?.[0];
		if (!w) return null;
		const defs =
			w.definitions?.map((d) => d.text).filter((t): t is string => Boolean(t)) ?? [];
		return defs.length
			? ({
					lang: 'ko',
					headword: w.hanja ? `${w.hangul} (${w.hanja})` : w.hangul,
					reading: w.romanization || w.pronunciation,
					definitions: defs
				} satisfies EntrySummary)
			: null;
	};

	const order =
		prefer === 'zh'
			? [zh, ja, ko]
			: prefer === 'ko'
				? [ko, ja, zh]
				: [ja, zh, ko]; // ja and tr (no Turkish dict) both prefer Japanese first

	for (const fn of order) {
		const r = fn();
		if (r) {
			r.definitions = demoteProperNouns(r.definitions);
			return r;
		}
	}
	return null;
}

/**
 * Proper-noun / name senses (e.g. CEDICT "surname Cheng", "place name …")
 * are almost never the meaning intended in a sentence-builder exercise, yet
 * dictionaries often list them first. Stable-partition them to the end so
 * the substantive senses lead, without losing them entirely.
 */
function isProperNounDef(def: string): boolean {
	const d = def.trim();
	return (
		/^\(?(a |an |old )*(chinese )?surname\b/i.test(d) ||
		/\bsurname\b/i.test(d) ||
		/^\(?(a |an )?(place|given|personal|person'?s|family|clan|county|country|dynasty|era|reign) name\b/i.test(
			d
		) ||
		/^name of (a|an|the)\b/i.test(d) ||
		/^\(?(place ?name|placename|person ?name|given ?name)\)?$/i.test(d)
	);
}

function demoteProperNouns(defs: string[]): string[] {
	const substantive: string[] = [];
	const proper: string[] = [];
	for (const d of defs) (isProperNounDef(d) ? proper : substantive).push(d);
	// Only demote when there's something substantive to lead with; if every
	// sense is a name (e.g. a genuine surname entry), keep the original order.
	return substantive.length ? [...substantive, ...proper] : defs;
}
