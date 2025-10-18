import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { expandFields } from '$lib/field-mappings';
import { getDictionaryUrl } from '$lib/shard-utils';
import { dev } from '$app/environment';

// Disable SSR for this route to avoid hanging during development
export const ssr = false;

export const load: PageLoad = async ({ params, fetch }) => {
	const { word } = params;

	try {
		// Fetch the dictionary data (local in dev, jsDelivr in prod)
		const url = getDictionaryUrl(word);
		console.log(`[${dev ? 'DEV' : 'PROD'}] Fetching from: ${url}`);
		const response = await fetch(url);

		if (!response.ok) {
			throw error(404, `Character "${word}" not found`);
		}

		const rawData = await response.json();
		// Expand optimized field names to readable names
		let data = expandFields(rawData);

		// If this is a redirect entry, fetch the actual data
		if (data.redirect) {
			const redirectUrl = getDictionaryUrl(data.redirect);
			const redirectResponse = await fetch(redirectUrl);
			if (redirectResponse.ok) {
				const redirectRawData = await redirectResponse.json();
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
						const relatedRawData = await relatedResponse.json();
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

