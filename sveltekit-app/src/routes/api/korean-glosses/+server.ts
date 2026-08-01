import { json } from '@sveltejs/kit';
import { inflateSync } from 'fflate';
import type { RequestHandler } from './$types';
import { getRawGitHubUrl } from '$lib/shard-utils';
import { buildWordTokens } from '$lib/utils/segment';
import { koreanDeinflect } from '$lib/utils/korean-deinflect';
import {
	compactKoreanGloss,
	getKoreanDisplayTokens,
	getKoreanMorphologyGloss,
	getKoreanSuffixGloss,
} from '$lib/server/korean-gloss-helpers';

const MAX_SENTENCES = 8;
const MAX_TOTAL_CHARACTERS = 1_200;
const glossCache = new Map<string, string | null>();

export const POST: RequestHandler = async ({ request, fetch }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const texts = Array.isArray((body as { texts?: unknown })?.texts)
		? (body as { texts: unknown[] }).texts.filter((text): text is string => typeof text === 'string')
		: [];
	const uniqueTexts = [...new Set(texts.map((text) => text.trim()).filter(Boolean))];
	if (uniqueTexts.length === 0 || uniqueTexts.length > MAX_SENTENCES) {
		return json({ error: `Provide between 1 and ${MAX_SENTENCES} sentences` }, { status: 400 });
	}
	if (uniqueTexts.reduce((total, text) => total + text.length, 0) > MAX_TOTAL_CHARACTERS) {
		return json({ error: 'Sentence payload is too large' }, { status: 413 });
	}

	const words = [...new Set(uniqueTexts.flatMap(getKoreanDisplayTokens))];
	const entries = await mapWithConcurrency(words, 6, async (word) => [word, await lookupVisibleKoreanGloss(word, fetch)] as const);
	const wordGlosses = new Map(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])));
	const glosses = Object.fromEntries(uniqueTexts.map((text) => [
		text,
		Object.fromEntries(
			getKoreanDisplayTokens(text)
				.map((token) => [token, wordGlosses.get(token)])
				.filter((entry): entry is [string, string] => Boolean(entry[1]))
		),
	]));

	return json({ glosses }, {
		headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' },
	});
};

async function lookupVisibleKoreanGloss(
	word: string,
	fetchFn: typeof fetch,
): Promise<string | null> {
	const morphologyGloss = getKoreanMorphologyGloss(word);
	if (morphologyGloss) return morphologyGloss;

	const directGloss = await lookupKoreanGloss(word, fetchFn);
	if (directGloss) return directGloss;

	const subtokens = buildWordTokens(word, 'ko')
		.map((token) => token.surfaceForm)
		.filter((token) => token !== word && /[\p{Script=Han}\p{Script=Latin}\uAC00-\uD7A3]/u.test(token));
	if (subtokens.length > 0) {
		const resolved = await Promise.all(subtokens.map(async (token) =>
			getKoreanMorphologyGloss(token) ?? await lookupKoreanGloss(token, fetchFn)
		));
		const componentGlosses = [...new Set(resolved.filter((gloss): gloss is string => Boolean(gloss)))];
		if (componentGlosses.length > 0) return componentGlosses.join(' · ');
	}

	return getKoreanSuffixGloss(word);
}

async function lookupKoreanGloss(
	word: string,
	fetchFn: typeof fetch,
): Promise<string | null> {
	if (glossCache.has(word)) return glossCache.get(word) ?? null;

	const candidates = koreanDeinflect(word);
	const orderedCandidates = [
		...candidates.filter((candidate) => candidate.reasons.length > 0),
		...particleStrippedForms(word).map((candidate) => ({ word: candidate, reasons: [] })),
		...candidates.filter((candidate) => candidate.reasons.length === 0),
	];
	const seen = new Set<string>();

	for (const candidate of orderedCandidates) {
		if (!candidate.word || seen.has(candidate.word)) continue;
		seen.add(candidate.word);
		const entry = await fetchDictionaryEntry(candidate.word, fetchFn);
		const gloss = extractKoreanGloss(entry);
		if (gloss) {
			const compact = compactKoreanGloss(gloss);
			cacheGloss(word, compact);
			return compact;
		}
		if (seen.size >= 8) break;
	}

	cacheGloss(word, null);
	return null;
}

function cacheGloss(word: string, gloss: string | null) {
	if (glossCache.size >= 5_000) {
		const oldest = glossCache.keys().next().value;
		if (oldest) glossCache.delete(oldest);
	}
	glossCache.set(word, gloss);
}

async function fetchDictionaryEntry(word: string, fetchFn: typeof fetch, depth = 0): Promise<any | null> {
	if (depth > 2) return null;
	try {
		const response = await fetchFn(getRawGitHubUrl(word));
		if (!response.ok) return null;
		const decompressed = inflateSync(new Uint8Array(await response.arrayBuffer()));
		const entry = JSON.parse(new TextDecoder().decode(decompressed));
		if (entry.redirect) return fetchDictionaryEntry(entry.redirect, fetchFn, depth + 1);
		return entry;
	} catch {
		return null;
	}
}

function extractKoreanGloss(entry: any): string | null {
	for (const word of entry?.korean_words || []) {
		for (const definition of word.definitions || []) {
			if (definition?.text && definition.text !== 'Sentence') return definition.text;
		}
	}
	return null;
}

function particleStrippedForms(word: string): string[] {
	const endings = ['으로', '에서', '에게', '한테', '처럼', '까지', '부터', '하고', '보다', '로', '은', '는', '이', '가', '을', '를', '의', '도', '와', '과'];
	return endings
		.filter((ending) => word.endsWith(ending) && word.length > ending.length)
		.map((ending) => word.slice(0, -ending.length));
}

async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	mapper: (item: T) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let nextIndex = 0;
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (nextIndex < items.length) {
			const index = nextIndex++;
			results[index] = await mapper(items[index]);
		}
	}));
	return results;
}
