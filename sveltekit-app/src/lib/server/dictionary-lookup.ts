import { getRawGitHubUrl } from '$lib/shard-utils';
import { inflateSync } from 'fflate';

interface LookupResult {
	dictionaryForm: string | null;
	reading: string | null;
	gloss: string | null;
}

async function fetchEntry(word: string): Promise<any | null> {
	try {
		const url = getRawGitHubUrl(word);
		const resp = await fetch(url);
		if (!resp.ok) return null;
		const compressed = new Uint8Array(await resp.arrayBuffer());
		const decompressed = inflateSync(compressed);
		const json = new TextDecoder().decode(decompressed);
		const data = JSON.parse(json);
		if (data.redirect) {
			return fetchEntry(data.redirect);
		}
		return data;
	} catch {
		return null;
	}
}

function extractReading(data: any): string | null {
	// Japanese
	if (data.japanese_words?.length > 0) {
		const jw = data.japanese_words[0];
		if (jw.kana?.length > 0) return jw.kana[0].text;
	}
	// Chinese pinyin
	if (data.chinese_words?.length > 0) {
		for (const item of data.chinese_words[0].items || []) {
			if (item.pinyin) return item.pinyin;
		}
	}
	// Korean
	if (data.korean_words?.length > 0) {
		const kw = data.korean_words[0];
		if (kw.hangul) return kw.hangul;
	}
	return null;
}

function extractGloss(data: any): string | null {
	// Japanese
	if (data.japanese_words?.length > 0) {
		for (const sense of data.japanese_words[0].sense || []) {
			for (const g of sense.gloss || []) {
				if (g.text) return g.text;
			}
		}
	}
	// Chinese
	if (data.chinese_words?.length > 0) {
		for (const item of data.chinese_words[0].items || []) {
			if (item.definitions?.length > 0) return item.definitions[0];
		}
	}
	// Korean
	if (data.korean_words?.length > 0) {
		if (data.korean_words[0].definitions?.length > 0) {
			return data.korean_words[0].definitions[0].text || null;
		}
	}
	return null;
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
	return guesses;
}

/**
 * Look up a word in the dictionary with deconjugation fallback.
 * Returns precomputed reading, gloss, and dictionary form.
 */
export async function lookupWord(surfaceForm: string, language: string): Promise<LookupResult> {
	// Direct lookup
	let data = await fetchEntry(surfaceForm);
	if (data) {
		return {
			dictionaryForm: null, // same as surface form
			reading: extractReading(data),
			gloss: extractGloss(data),
		};
	}

	// Deconjugation fallback for Japanese
	if (language === 'ja') {
		const guesses = guessJapaneseDictionaryForms(surfaceForm);
		for (const guess of guesses) {
			data = await fetchEntry(guess);
			if (data) {
				return {
					dictionaryForm: guess,
					reading: extractReading(data),
					gloss: extractGloss(data),
				};
			}
		}
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
				const leftGloss = extractGloss(leftData);
				const rightGloss = extractGloss(rightData);
				const leftReading = extractReading(leftData);
				const rightReading = extractReading(rightData);

				return {
					dictionaryForm: left + ' + ' + right,
					reading: [leftReading, rightReading].filter(Boolean).join(' + ') || null,
					gloss: [leftGloss, rightGloss].filter(Boolean).join(' + ') || null,
				};
			}
		}
	}

	return { dictionaryForm: null, reading: null, gloss: null };
}
