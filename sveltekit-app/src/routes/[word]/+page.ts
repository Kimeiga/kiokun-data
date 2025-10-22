import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getDictionaryUrl } from '$lib/shard-utils';
import { dev } from '$app/environment';
import { decompressSync, strFromU8 } from 'fflate';

// Disable SSR for this route to avoid hanging during development
export const ssr = false;

/**
 * Decompress Deflate-compressed data and parse as JSON
 * @param compressedData - ArrayBuffer containing Deflate-compressed data
 * @returns Parsed JSON object
 */
function decompressAndParse(compressedData: ArrayBuffer): any {
	const uint8Array = new Uint8Array(compressedData);

	// Decompress using raw deflate (no headers)
	const decompressed = decompressSync(uint8Array);

	// Convert decompressed bytes to string
	const jsonString = strFromU8(decompressed);

	// Parse JSON
	return JSON.parse(jsonString);
}

export const load: PageLoad = async ({ params, fetch }) => {
	const { word } = params;

	try {
		// Fetch the compressed dictionary data (uses localhost:8000 in dev mode)
		const url = getDictionaryUrl(word, dev);
		console.log(`[${dev ? 'DEV' : 'PROD'}] Fetching from: ${url}`);
		console.log(`[DEBUG] dev=${dev}, word="${word}"`);
		const response = await fetch(url);
		console.log(`[DEBUG] Response status: ${response.status}, ok: ${response.ok}`);

		if (!response.ok) {
			throw error(404, `Character "${word}" not found`);
		}

		// Get compressed data as ArrayBuffer
		const compressedData = await response.arrayBuffer();
		console.log(`[DEBUG] Compressed size: ${compressedData.byteLength} bytes`);

		// Decompress and parse JSON
		let data = decompressAndParse(compressedData);
		console.log('[DEBUG] Decompressed successfully');
		console.log('[DEBUG] Raw decompressed JSON:', data);

		if (data.japanese_names) {
			console.log('[DEBUG] Japanese names count:', data.japanese_names.length);
			console.log('[DEBUG] First 3 Japanese names:', data.japanese_names.slice(0, 3));
		}

		// If this is a redirect entry, fetch the actual data
		if (data.redirect) {
			const redirectUrl = getDictionaryUrl(data.redirect, dev);
			const redirectResponse = await fetch(redirectUrl);
			if (redirectResponse.ok) {
				const redirectCompressed = await redirectResponse.arrayBuffer();
				data = decompressAndParse(redirectCompressed);
			}
		}

		// Load Japanese labels
		let labels: any = {};
		try {
			const labelsResponse = await fetch('/japanese_labels.json');
			if (labelsResponse.ok) {
				labels = await labelsResponse.json();
			}
		} catch (err) {
			console.error('Failed to load labels:', err);
		}

		// Fetch related Japanese words
		const relatedJapaneseWords: any[] = [];
		if (data.related_japanese_words && data.related_japanese_words.length > 0) {
			for (const relatedKey of data.related_japanese_words) {
				try {
					const relatedUrl = getDictionaryUrl(relatedKey, dev);
					const relatedResponse = await fetch(relatedUrl);
					if (relatedResponse.ok) {
						const relatedCompressed = await relatedResponse.arrayBuffer();
						const relatedData = decompressAndParse(relatedCompressed);
						if (relatedData.japanese_words && relatedData.japanese_words.length > 0) {
							relatedData.japanese_words.forEach((japWord: any) => {
								relatedJapaneseWords.push({
									word: japWord,
									isDirect: false,
									sourceKey: relatedKey
								});
							});
						}
					}
				} catch (err) {
					console.error(`Failed to fetch related word: ${relatedKey}`, err);
				}
			}
		}

		return {
			word,
			data,
			relatedJapaneseWords,
			labels
		};
	} catch (err) {
		console.error(`Failed to load dictionary entry for "${word}":`, err);
		throw error(404, `Character "${word}" not found`);
	}
};

