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
 * Try to find kanji form from hiragana reading using the lookup-reading API
 */
async function findKanjiFromReading(
	hiragana: string,
	fetchFn: typeof fetch = fetch
): Promise<string | null> {
	try {
		const response = await fetchFn(`/api/lookup-reading?q=${encodeURIComponent(hiragana)}&limit=5`);
		if (!response.ok) return null;

		const data = await response.json();
		if (data.results && data.results.length > 0) {
			// Return the first (most common) kanji form
			return data.results[0].word;
		}
	} catch {
		// API not available (e.g., during SSR or in dev without D1)
	}
	return null;
}

/**
 * Try to find a dictionary entry for a word, including deinflected forms
 *
 * @param word - The word to check
 * @param fetchFn - Optional fetch function
 * @returns Object with found word and deinflection info, or null if not found
 */
export async function findWordWithDeinflection(
	word: string,
	fetchFn: typeof fetch = fetch
): Promise<DeinflectionResult | null> {
	const trimmedWord = word.trim();
	if (!trimmedWord) return null;

	// First try the exact word
	try {
		const url = await getDictionaryUrl(trimmedWord, dev, fetchFn);
		const response = await fetchFn(url, { method: 'HEAD' });
		if (response.ok) {
			return { originalWord: trimmedWord, dictionaryForm: trimmedWord, conjugationInfo: '' };
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
		try {
			// First try direct dictionary lookup
			const url = await getDictionaryUrl(candidate.word, dev, fetchFn);
			const response = await fetchFn(url, { method: 'HEAD' });
			if (response.ok) {
				return {
					originalWord: trimmedWord,
					dictionaryForm: candidate.word,
					conjugationInfo: formatReasonChains(candidate.reasonChains),
				};
			}

			// If direct lookup failed and candidate is hiragana-only,
			// try to find the kanji form via the reading lookup API
			if (isHiraganaOnly(candidate.word)) {
				const kanjiForm = await findKanjiFromReading(candidate.word, fetchFn);
				if (kanjiForm) {
					// Verify the kanji form exists in the dictionary
					const kanjiUrl = await getDictionaryUrl(kanjiForm, dev, fetchFn);
					const kanjiResponse = await fetchFn(kanjiUrl, { method: 'HEAD' });
					if (kanjiResponse.ok) {
						return {
							originalWord: trimmedWord,
							dictionaryForm: kanjiForm,
							conjugationInfo: formatReasonChains(candidate.reasonChains),
						};
					}
				}
			}
		} catch {
			// Continue to next candidate
		}
	}

	return null;
}

/**
 * Navigate to a word if it exists in the dictionary, otherwise redirect to search
 *
 * This function:
 * 1. Tries to fetch the word from the dictionary (including deinflected forms)
 * 2. If found, navigates to /{word} with optional conjugation info
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
		const result = await findWordWithDeinflection(trimmedWord, fetchFn);

		if (result) {
			// Word found (possibly via deinflection)
			if (result.conjugationInfo && result.originalWord !== result.dictionaryForm) {
				// Navigate with conjugation info
				await goto(`/${result.dictionaryForm}?from=${encodeURIComponent(result.originalWord)}&conj=${encodeURIComponent(result.conjugationInfo)}`);
			} else {
				// Direct match
				await goto(`/${result.dictionaryForm}`);
			}
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

