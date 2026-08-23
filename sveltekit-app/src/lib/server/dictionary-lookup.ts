import { getRawGitHubUrl } from '$lib/shard-utils';
import { inflateSync } from 'fflate';
import type { D1Database } from '@cloudflare/workers-types';

interface LookupResult {
	dictionaryForm: string | null;
	reading: string | null;
	gloss: string | null;
}

export interface DictionaryLookupOptions {
	db?: D1Database;
	reading?: string | null;
	preferDeconjugation?: boolean;
}

interface JapaneseReadingRow {
	word: string;
	pronunciation: string;
	definition: string;
	is_common: number;
}

async function fetchEntry(word: string, redirectsRemaining = 4, seen = new Set<string>()): Promise<any | null> {
	if (!word || seen.has(word)) return null;
	seen.add(word);
	try {
		const url = getRawGitHubUrl(word);
		const resp = await fetch(url);
		if (!resp.ok) return null;
		const compressed = new Uint8Array(await resp.arrayBuffer());
		const decompressed = inflateSync(compressed);
		const json = new TextDecoder().decode(decompressed);
		const data = JSON.parse(json);
		if (data.redirect) {
			if (redirectsRemaining <= 0) return null;
			return fetchEntry(data.redirect, redirectsRemaining - 1, seen);
		}
		return data;
	} catch {
		return null;
	}
}

function katakanaToHiragana(value: string): string {
	return value.replace(/[\u30A1-\u30F6]/g, (character) =>
		String.fromCharCode(character.charCodeAt(0) - 0x60)
	);
}

export async function findJapaneseReadingMatch(
	reading: string,
	db?: D1Database
): Promise<JapaneseReadingRow | null> {
	if (!db || !reading) return null;
	const normalized = katakanaToHiragana(reading.trim());
	if (!normalized) return null;

	try {
		const result = await db.prepare(`
			SELECT word, pronunciation, definition, is_common
			FROM dictionary_search
			WHERE language = 'japanese'
			  AND pronunciation = ?
			  AND definition IS NOT NULL
			  AND definition != ''
			ORDER BY is_common DESC, LENGTH(word) ASC, rowid ASC
			LIMIT 20
		`).bind(normalized).all<JapaneseReadingRow>();

		const rows = result.results || [];
		return rows.find((row) => row.word === normalized && Boolean(row.is_common))
			|| rows.find((row) => row.word !== normalized && Boolean(row.is_common))
			|| rows.find((row) => row.word === normalized)
			|| rows[0]
			|| null;
	} catch (error) {
		console.error('Japanese reading lookup failed:', error);
		return null;
	}
}

function extractJapaneseReading(data: any): string | null {
	if (data.japanese_words?.length > 0) {
		const jw = data.japanese_words[0];
		if (jw.kana?.length > 0) return jw.kana[0].text;
	}
	return null;
}

function extractChineseCandidate(data: any): { reading: string | null; gloss: string | null } | null {
	const candidates: Array<{ reading: string | null; gloss: string; score: number }> = [];
	if (data.chinese_words?.length > 0) {
		for (const word of data.chinese_words) {
			for (const item of word.items || []) {
				for (const definition of item.definitions || []) {
					if (!definition) continue;
					let score = definition.length;
					if (/\bsurname\b|\bfamily name\b/i.test(definition)) score += 1_000;
					if (/\bvariant of\b|\barchaic\b|\bobsolete\b/i.test(definition)) score += 500;
					if (/\bcharacter from\b/i.test(definition)) score += 100;
					candidates.push({
						reading: item.pinyin || null,
						gloss: definition,
						score,
					});
				}
			}
		}
	}
	candidates.sort((a, b) => a.score - b.score);
	return candidates[0] || null;
}

function extractChineseReading(data: any): string | null {
	return extractChineseCandidate(data)?.reading || null;
}

function extractKoreanReading(data: any): string | null {
	if (data.korean_words?.length > 0) {
		const kw = data.korean_words[0];
		if (kw.hangul) return kw.hangul;
	}
	return null;
}

function extractReading(data: any, language: string): string | null {
	if (language === 'zh') {
		return extractChineseReading(data) || extractJapaneseReading(data) || extractKoreanReading(data);
	}
	if (language === 'ko') {
		return extractKoreanReading(data) || extractChineseReading(data) || extractJapaneseReading(data);
	}
	return extractJapaneseReading(data) || extractChineseReading(data) || extractKoreanReading(data);
}

function extractJapaneseGloss(data: any): string | null {
	if (data.japanese_words?.length > 0) {
		for (const sense of data.japanese_words[0].sense || []) {
			for (const g of sense.gloss || []) {
				if (g.text) return g.text;
			}
		}
	}
	return null;
}

function extractChineseGloss(data: any): string | null {
	return extractChineseCandidate(data)?.gloss || null;
}

function extractKoreanGloss(data: any): string | null {
	if (data.korean_words?.length > 0) {
		if (data.korean_words[0].definitions?.length > 0) {
			return data.korean_words[0].definitions[0].text || null;
		}
	}
	return null;
}

function extractGloss(data: any, language: string): string | null {
	if (language === 'zh') {
		return extractChineseGloss(data) || extractJapaneseGloss(data) || extractKoreanGloss(data);
	}
	if (language === 'ko') {
		return extractKoreanGloss(data) || extractChineseGloss(data) || extractJapaneseGloss(data);
	}
	return extractJapaneseGloss(data) || extractChineseGloss(data) || extractKoreanGloss(data);
}

// Japanese deconjugation: try common dictionary forms
function guessJapaneseDictionaryForms(stem: string): string[] {
	const guesses: string[] = [];
	const lastChar = stem.slice(-1);

	const godanMap: Record<string, string[]> = {
		'か': ['く'], 'き': ['く'], 'い': ['く', 'いる', 'う'],
		'が': ['がす', 'がる', 'ぐ'], 'ぎ': ['ぐ'],
		'さ': ['す'], 'し': ['す', 'する'],
		'た': ['つ'], 'ち': ['つ'],
		'な': ['ぬ'], 'に': ['ぬ'],
		'ば': ['ぶ'], 'び': ['ぶ'],
		'ま': ['む'], 'み': ['む'],
		'ら': ['る'], 'り': ['る'],
		'わ': ['う'],
		'っ': ['る', 'つ', 'う'],
		'え': ['える'], 'け': ['ける'], 'せ': ['せる'],
		'て': ['てる'], 'ね': ['ねる'], 'べ': ['べる'],
		'め': ['める'], 'れ': ['れる'],
	};

	const endings = godanMap[lastChar];
	if (endings) {
		const stemBase = stem.slice(0, -1);
		for (const ending of endings) {
			guesses.push(stemBase + ending);
		}
	}

	guesses.push(stem + 'る', stem + 'す', stem + 'く', stem + 'む');
	return [...new Set(guesses)].filter((guess) => guess !== stem);
}

function isAllJapaneseKana(value: string): boolean {
	return /^[\u3040-\u30ff\u31f0-\u31ffー]+$/u.test(value);
}

function isConnectedLatinTerm(value: string): boolean {
	return /^[\p{Script=Latin}\p{N}]+(?:[\-‐‑‒–—./・][\p{Script=Latin}\p{N}]+)*$/u.test(value);
}

async function lookupForm(
	form: string,
	language: string,
	options: DictionaryLookupOptions,
	reading: string | null
): Promise<(LookupResult & { matchedForm: string }) | null> {
	const data = await fetchEntry(form);
	const gloss = data ? extractGloss(data, language) : null;
	if (data && (gloss || language !== 'ja')) {
		if (language === 'ja' && gloss && form.length > 1 && isAllJapaneseKana(form)) {
			const commonReadingForm = await findJapaneseReadingMatch(reading || form, options.db);
			if (commonReadingForm && commonReadingForm.word !== form && commonReadingForm.is_common) {
				return {
					matchedForm: commonReadingForm.word,
					dictionaryForm: commonReadingForm.word,
					reading: commonReadingForm.pronunciation,
					gloss: commonReadingForm.definition,
				};
			}
		}
		return {
			matchedForm: form,
			dictionaryForm: null,
			reading: extractReading(data, language),
			gloss,
		};
	}

	if (language === 'ja') {
		const match = await findJapaneseReadingMatch(
			reading || (isAllJapaneseKana(form) ? form : ''),
			options.db
		);
		if (match) {
			return {
				matchedForm: match.word,
				dictionaryForm: match.word,
				reading: match.pronunciation,
				gloss: match.definition,
			};
		}
	}

	return null;
}

/**
 * Look up a word in the dictionary with deconjugation fallback.
 * Returns precomputed reading, gloss, and dictionary form.
 */
export async function lookupWord(
	surfaceForm: string,
	language: string,
	options: DictionaryLookupOptions = {}
): Promise<LookupResult> {
	const latinTerm = language === 'ja' && isConnectedLatinTerm(surfaceForm);
	const guesses = language === 'ja' && !latinTerm ? guessJapaneseDictionaryForms(surfaceForm) : [];
	const forms = options.preferDeconjugation
		? [...guesses, surfaceForm]
		: [surfaceForm, ...guesses];

	for (const form of [...new Set(forms)]) {
		const reading = form === surfaceForm
			? options.reading || (isAllJapaneseKana(form) ? form : null)
			: (isAllJapaneseKana(form) ? form : null);
		const result = await lookupForm(form, language, options, reading);
		if (result) {
			return {
				dictionaryForm: result.matchedForm === surfaceForm ? null : result.matchedForm,
				reading: result.reading,
				gloss: result.gloss,
			};
		}
	}

	if (latinTerm) {
		return { dictionaryForm: null, reading: null, gloss: surfaceForm };
	}

	// Compound word splitting fallback
	// Try splitting into two parts where both halves exist in the dictionary
	if (surfaceForm.length >= 2) {
		for (let i = 1; i < surfaceForm.length; i++) {
			const left = surfaceForm.slice(0, i);
			const right = surfaceForm.slice(i);
			// Skip very short splits (single kana particles)
			if (left.length < 2 && right.length < 2) continue;

			const [leftData, rightData] = await Promise.all([
				fetchEntry(left),
				fetchEntry(right),
			]);

			if (leftData && rightData) {
				const leftGloss = extractGloss(leftData, language);
				const rightGloss = extractGloss(rightData, language);
				if (!leftGloss || !rightGloss) continue;
				const leftReading = extractReading(leftData, language);
				const rightReading = extractReading(rightData, language);

				return {
					dictionaryForm: null,
					reading: [leftReading, rightReading].filter(Boolean).join(' + ') || null,
					gloss: [leftGloss, rightGloss].filter(Boolean).join(' + ') || null,
				};
			}
		}
	}

	return { dictionaryForm: null, reading: null, gloss: null };
}
