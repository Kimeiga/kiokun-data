import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { expandFields } from '$lib/field-mappings';
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
		// Fetch the compressed dictionary data
		const url = getDictionaryUrl(word);
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
		const rawData = decompressAndParse(compressedData);
		console.log(`[DEBUG] Decompressed successfully`);

		// Expand optimized field names to readable names
		let data = expandFields(rawData);

		// If this is a redirect entry, fetch the actual data
		if (data.redirect) {
			const redirectUrl = getDictionaryUrl(data.redirect);
			const redirectResponse = await fetch(redirectUrl);
			if (redirectResponse.ok) {
				const redirectCompressed = await redirectResponse.arrayBuffer();
				const redirectRawData = decompressAndParse(redirectCompressed);
				data = expandFields(redirectRawData);
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
					const relatedUrl = getDictionaryUrl(relatedKey);
					const relatedResponse = await fetch(relatedUrl);
					if (relatedResponse.ok) {
						const relatedCompressed = await relatedResponse.arrayBuffer();
						const relatedRawData = decompressAndParse(relatedCompressed);
						const relatedData = expandFields(relatedRawData);
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

