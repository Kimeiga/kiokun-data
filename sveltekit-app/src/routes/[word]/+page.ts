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

	try {
		// Fetch the compressed dictionary data with detailed logging
		const url = getDictionaryUrl(word, dev);
		const startTime = performance.now();

		console.log(`[FETCH] Starting fetch for "${word}"`);
		console.log(`[FETCH] Environment: ${dev ? 'DEV' : 'PROD'}`);
		console.log(`[FETCH] URL: ${url}`);
		console.log(`[FETCH] Shard: ${getShardName(word)}`);

		const response = await fetch(url);
		const fetchTime = performance.now() - startTime;

		console.log(`[FETCH] Response received in ${fetchTime.toFixed(2)}ms`);
		console.log(`[FETCH] Status: ${response.status} ${response.statusText}`);
		console.log(`[FETCH] OK: ${response.ok}`);
		console.log(`[FETCH] Headers:`, {
			'content-type': response.headers.get('content-type'),
			'content-length': response.headers.get('content-length'),
			'cache-control': response.headers.get('cache-control'),
			'age': response.headers.get('age'),
			'x-cache': response.headers.get('x-cache'),
			'cf-cache-status': response.headers.get('cf-cache-status'),
			'x-served-by': response.headers.get('x-served-by'),
		});

		if (!response.ok) {
			console.error(`[FETCH] Failed to load "${word}" - returning 404`);
			throw error(404, `Character "${word}" not found`);
		}

		// Get compressed data as ArrayBuffer
		const downloadStartTime = performance.now();
		const compressedData = await response.arrayBuffer();
		const downloadTime = performance.now() - downloadStartTime;

		console.log(`[DOWNLOAD] Downloaded ${compressedData.byteLength} bytes in ${downloadTime.toFixed(2)}ms`);
		console.log(`[DOWNLOAD] Speed: ${(compressedData.byteLength / 1024 / (downloadTime / 1000)).toFixed(2)} KB/s`);

		// Decompress and parse JSON
		const decompressStartTime = performance.now();
		let data: DictionaryEntry = decompressAndParse(compressedData);
		const decompressTime = performance.now() - decompressStartTime;

		console.log(`[DECOMPRESS] Decompressed in ${decompressTime.toFixed(2)}ms`);
		console.log(`[DECOMPRESS] Data structure:`, {
			hasChinese: !!data.chinese_char || (data.chinese_words && data.chinese_words.length > 0),
			hasJapanese: !!data.japanese_char || (data.japanese_words && data.japanese_words.length > 0),
			hasNames: !!(data.japanese_names && data.japanese_names.length > 0),
			isRedirect: !!data.redirect,
		});



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

		const totalTime = performance.now() - startTime;
		console.log(`[LOAD] ✅ Successfully loaded "${word}" in ${totalTime.toFixed(2)}ms`);
		console.log(`[LOAD] Related words: ${relatedJapaneseWords.length}`);

		return {
			word,
			data,
			relatedJapaneseWords,
			labels
		};
	} catch (err) {
		console.error(`[LOAD] ❌ Failed to load dictionary entry for "${word}":`, err);
		throw error(404, `Character "${word}" not found`);
	}
};

