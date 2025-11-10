import { goto } from '$app/navigation';
import { getDictionaryUrl } from '$lib/shard-utils';
import { dev } from '$app/environment';

/**
 * Navigate to a word if it exists in the dictionary, otherwise redirect to search
 *
 * This function:
 * 1. Tries to fetch the word from the dictionary
 * 2. If found, navigates to /{word}
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
		// Try to fetch the word from the dictionary
		const url = await getDictionaryUrl(trimmedWord, dev, fetchFn);
		const response = await fetchFn(url, { method: 'HEAD' }); // Use HEAD to avoid downloading the full file

		if (response.ok) {
			// Word exists, navigate to it
			await goto(`/${trimmedWord}`);
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

