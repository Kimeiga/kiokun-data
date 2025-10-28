import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getDictionaryUrl, getShardName } from '$lib/shard-utils';
import { dev } from '$app/environment';
import { decompressSync, strFromU8 } from 'fflate';
import type { DictionaryEntry } from '$lib/types';

// Disable SSR for this route to avoid hanging during development
export const ssr = false;

/**
 * Decompress Deflate-compressed data and parse as JSON
 * @param compressedData - ArrayBuffer containing Deflate-compressed data
 * @returns Parsed dictionary entry
 */
function decompressAndParse(compressedData: ArrayBuffer): DictionaryEntry {
	const uint8Array = new Uint8Array(compressedData);

	// Decompress using raw deflate (no headers)
	const decompressed = decompressSync(uint8Array);

	// Convert decompressed bytes to string
	const jsonString = strFromU8(decompressed);

	// Parse JSON and return as DictionaryEntry
	return JSON.parse(jsonString) as DictionaryEntry;
}

/**
 * Related Japanese word entry with metadata
 */
interface RelatedJapaneseWord {
	word: import('$lib/types').JapaneseWord;
	isDirect: boolean;
	sourceKey: string;
}

/**
 * Japanese labels mapping (tag codes to full text)
 */
interface JapaneseLabels {
	[key: string]: string;
}

/**
 * Page data returned by the load function
 */
export interface PageData {
	word: string;
	data: DictionaryEntry;
	relatedJapaneseWords: RelatedJapaneseWord[];
	labels: JapaneseLabels;
}

export const load: PageLoad<PageData> = async ({ params, fetch }) => {
	const { word } = params;
	console.log('[LOAD] Starting load for word:', word);

	try {
		// Fetch the compressed dictionary data
		const url = getDictionaryUrl(word, dev);
		console.log('[LOAD] Fetching URL:', url);
		const response = await fetch(url);
		console.log('[LOAD] Response status:', response.status);

		if (!response.ok) {
			console.error(`Failed to load "${word}"`);
			throw error(404, `Character "${word}" not found`);
		}

		// Get compressed data and decompress
		const compressedData = await response.arrayBuffer();
		let data: DictionaryEntry = decompressAndParse(compressedData);

		// Debug: Log image data for historical evolution
		if (data.chinese_char?.images) {
			// Filter out any undefined/null images
			data.chinese_char.images = data.chinese_char.images.filter((img: any) => img != null);
			console.log(`[IMAGES] Found ${data.chinese_char.images.length} images for "${word}":`, data.chinese_char.images);
		} else {
			console.log(`[IMAGES] No images found for "${word}"`);
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
		let labels: JapaneseLabels = {};
		try {
			const labelsResponse = await fetch('/japanese_labels.json');
			if (labelsResponse.ok) {
				labels = await labelsResponse.json();
			}
		} catch (err) {
			console.error('Failed to load labels:', err);
		}

		// Fetch related Japanese words
		const relatedJapaneseWords: RelatedJapaneseWord[] = [];
		if (data.related_japanese_words && data.related_japanese_words.length > 0) {
			for (const relatedKey of data.related_japanese_words) {
				try {
					const relatedUrl = getDictionaryUrl(relatedKey, dev);
					const relatedResponse = await fetch(relatedUrl);
					if (relatedResponse.ok) {
						const relatedCompressed = await relatedResponse.arrayBuffer();
						const relatedData: DictionaryEntry = decompressAndParse(relatedCompressed);
						if (relatedData.japanese_words && relatedData.japanese_words.length > 0) {
							relatedData.japanese_words.forEach((japWord) => {
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

