import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

// Disable SSR for this route to avoid hanging during development
export const ssr = false;

export const load: PageLoad = async ({ params, fetch }) => {
	const { word } = params;

	try {
		// Fetch the dictionary data from D1 database via API
		const response = await fetch(`/api/dictionary/${word}`);

		if (!response.ok) {
			throw error(404, `Character "${word}" not found`);
		}

		const data = await response.json();

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
		const relatedJapaneseWords = [];
		if (data.related_japanese_words && data.related_japanese_words.length > 0) {
			for (const relatedKey of data.related_japanese_words) {
				try {
					const relatedResponse = await fetch(`/api/dictionary/${relatedKey}`);
					if (relatedResponse.ok) {
						const relatedData = await relatedResponse.json();
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

