import { goto } from '$app/navigation';
import { getDictionaryUrl } from '$lib/shard-utils';
import { dev } from '$app/environment';
import { deinflect, formatReasonChains } from '$lib/utils/deinflect';

export interface DeinflectionResult {
	originalWord: string;
	dictionaryForm: string;
	conjugationInfo: string;
}

/**
 * Result with multiple alternative matches
 */
export interface DeinflectionResults {
	originalWord: string;
	primary: DeinflectionResult;
	alternatives: DeinflectionResult[];
}

/**
 * Check if a string contains only hiragana characters
 */
function isHiraganaOnly(str: string): boolean {
	// Hiragana range: U+3040 to U+309F
	for (let i = 0; i < str.length; i++) {
		const code = str.charCodeAt(i);
		if (code < 0x3040 || code > 0x309F) {
			return false;
		}
	}
	return str.length > 0;
}

/**
 * Try to find kanji forms from hiragana reading using the lookup-reading API
 * Returns multiple forms if available (for ambiguous readings)
 */
async function findKanjiFormsFromReading(
	hiragana: string,
	fetchFn: typeof fetch = fetch
): Promise<string[]> {
	try {
		const response = await fetchFn(`/api/lookup-reading?q=${encodeURIComponent(hiragana)}&limit=10`);
		if (!response.ok) return [];

		const data = await response.json();
		if (data.results && data.results.length > 0) {
			// Return all kanji forms found
			return data.results.map((r: { word: string }) => r.word);
		}
	} catch {
		// API not available (e.g., during SSR or in dev without D1)
	}
	return [];
}

/**
 * Try to find dictionary entries for a word, including deinflected forms
 * Returns multiple matches when a conjugated form could map to different words
 *
 * @param word - The word to check
 * @param fetchFn - Optional fetch function
 * @param maxResults - Maximum number of results to return (default: 5)
 * @returns Object with primary match and alternatives, or null if not found
 */
export async function findWordsWithDeinflection(
	word: string,
	fetchFn: typeof fetch = fetch,
	maxResults: number = 5
): Promise<DeinflectionResults | null> {
	const trimmedWord = word.trim();
	if (!trimmedWord) return null;

	const matches: DeinflectionResult[] = [];
	const seenWords = new Set<string>();

	// Helper to add a match if not already seen
	const addMatch = (dictionaryForm: string, conjugationInfo: string) => {
		if (!seenWords.has(dictionaryForm) && matches.length < maxResults) {
			seenWords.add(dictionaryForm);
			matches.push({
				originalWord: trimmedWord,
				dictionaryForm,
				conjugationInfo,
			});
		}
	};

	// First try the exact word
	try {
		const url = await getDictionaryUrl(trimmedWord, dev, fetchFn);
		const response = await fetchFn(url, { method: 'HEAD' });
		if (response.ok) {
			addMatch(trimmedWord, '');
		}
	} catch {
		// Continue to try deinflection
	}

	// Try deinflected forms
	const candidates = deinflect(trimmedWord);

	// Skip the first candidate if it's the original word with no reasons
	const deinflectedCandidates = candidates.filter(
		c => c.word !== trimmedWord || c.reasonChains.length > 0
	);

	// Sort by number of conjugation steps (prefer simpler deinflections)
	deinflectedCandidates.sort((a, b) => {
		const aLen = a.reasonChains.reduce((sum, chain) => sum + chain.length, 0);
		const bLen = b.reasonChains.reduce((sum, chain) => sum + chain.length, 0);
		return aLen - bLen;
	});

	for (const candidate of deinflectedCandidates) {
		if (matches.length >= maxResults) break;

		try {
			const conjugationInfo = formatReasonChains(candidate.reasonChains);

			// First try direct dictionary lookup
			const url = await getDictionaryUrl(candidate.word, dev, fetchFn);
			const response = await fetchFn(url, { method: 'HEAD' });
			if (response.ok) {
				addMatch(candidate.word, conjugationInfo);
				continue;
			}

			// If direct lookup failed and candidate is hiragana-only,
			// try to find kanji forms via the reading lookup API
			if (isHiraganaOnly(candidate.word)) {
				const kanjiForms = await findKanjiFormsFromReading(candidate.word, fetchFn);
				for (const kanjiForm of kanjiForms) {
					if (matches.length >= maxResults) break;
					try {
						// Verify the kanji form exists in the dictionary
						const kanjiUrl = await getDictionaryUrl(kanjiForm, dev, fetchFn);
						const kanjiResponse = await fetchFn(kanjiUrl, { method: 'HEAD' });
						if (kanjiResponse.ok) {
							addMatch(kanjiForm, conjugationInfo);
						}
					} catch {
						// Continue to next kanji form
					}
				}
			}
		} catch {
			// Continue to next candidate
		}
	}

	if (matches.length === 0) {
		return null;
	}

	return {
		originalWord: trimmedWord,
		primary: matches[0],
		alternatives: matches.slice(1),
	};
}

/**
 * Legacy function - returns only the first match
 * @deprecated Use findWordsWithDeinflection for multiple results
 */
export async function findWordWithDeinflection(
	word: string,
	fetchFn: typeof fetch = fetch
): Promise<DeinflectionResult | null> {
	const results = await findWordsWithDeinflection(word, fetchFn, 1);
	return results?.primary || null;
}

/**
 * Navigate to a word if it exists in the dictionary, otherwise redirect to search
 *
 * This function:
 * 1. Tries to fetch the word from the dictionary (including deinflected forms)
 * 2. If found, navigates to /{word} with conjugation info and alternatives
 * 3. If not found (404), redirects to /search?q={word}
 *
 * @param word - The word to search for
 * @param fetchFn - Optional fetch function (defaults to global fetch)
 */
export async function navigateOrSearch(word: string, fetchFn: typeof fetch = fetch): Promise<void> {
	if (!word || word.trim().length === 0) {
		return;
	}

	const trimmedWord = word.trim();

	try {
		const results = await findWordsWithDeinflection(trimmedWord, fetchFn);

		if (results) {
			const { primary, alternatives } = results;

			// Build URL with primary match
			let url = `/${primary.dictionaryForm}`;
			const params = new URLSearchParams();

			if (primary.conjugationInfo && primary.originalWord !== primary.dictionaryForm) {
				params.set('from', primary.originalWord);
				params.set('conj', primary.conjugationInfo);
			}

			// Add alternatives as JSON-encoded param
			if (alternatives.length > 0) {
				const altData = alternatives.map(a => ({
					word: a.dictionaryForm,
					conj: a.conjugationInfo,
				}));
				params.set('alt', JSON.stringify(altData));
			}

			const queryString = params.toString();
			if (queryString) {
				url += '?' + queryString;
			}

			await goto(url);
		} else {
			// Word not found, redirect to search
			await goto(`/search?q=${encodeURIComponent(trimmedWord)}`);
		}
	} catch (error) {
		// On error, redirect to search as fallback
		console.error('Error checking word existence:', error);
		await goto(`/search?q=${encodeURIComponent(trimmedWord)}`);
	}
}

