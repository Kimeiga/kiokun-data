import type { PageLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getDictionaryUrl } from '$lib/shard-utils';
import { dev } from '$app/environment';
import { decompressSync, strFromU8 } from 'fflate';
import type { DictionaryEntry } from '$lib/types';
import { findWordsWithDeinflection } from '$lib/utils/search-navigation';

// SSR enabled: load function fetches from GitHub CDN which works on both server and client.
// In dev mode, fetches go to local CORS proxy — SvelteKit's fetch handles this correctly.

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
 * Japanese labels mapping (tag codes to full text)
 */
interface JapaneseLabels {
	[key: string]: string;
}

/**
 * Character gloss mapping (char to unique English keyword)
 */
interface CharGlosses {
	[char: string]: string;
}

/**
 * Character taxonomy mapping (char to category path array)
 */
interface CharTaxonomy {
	[char: string]: string[];
}

/**
 * Component uses data - shows which characters use this character as a component
 */
interface ComponentTypeData {
	chars: string[];
	count: number;
	verified: number;
}

interface ComponentUsesMap {
	[char: string]: {
		[componentType: string]: ComponentTypeData;
	};
}

/**
 * Page data returned by the load function
 */
/**
 * Alternative conjugation match
 */
export interface ConjugationAlternative {
	word: string;
	conj: string;
}

export interface PageData {
	word: string;
	data: DictionaryEntry;
	labels: JapaneseLabels;
	charGlosses: CharGlosses;
	charTaxonomy: CharTaxonomy;
	componentUses: ComponentUsesMap;
	// Conjugation info (passed via URL params when arriving from deinflection)
	conjugatedFrom?: string;  // The original conjugated word
	conjugationInfo?: string; // Human-readable conjugation description
	conjugationAlternatives?: ConjugationAlternative[]; // Other possible matches
}

export const load: PageLoad<PageData> = async ({ params, fetch, url }) => {
	const { word } = params;

	// Get conjugation info from URL params (set by deinflection navigation)
	const conjugatedFrom = url.searchParams.get('from') || undefined;
	const conjugationInfo = url.searchParams.get('conj') || undefined;

	// Parse alternative conjugation matches
	let conjugationAlternatives: ConjugationAlternative[] | undefined;
	const altParam = url.searchParams.get('alt');
	if (altParam) {
		try {
			conjugationAlternatives = JSON.parse(altParam) as ConjugationAlternative[];
		} catch {
			// Invalid JSON, ignore
		}
	}

	console.log('[LOAD] Starting load for word:', word);

	// Fetch the compressed dictionary data
	const dictUrl = await getDictionaryUrl(word, dev, fetch);
	console.log('[LOAD] Fetching URL:', dictUrl);
	const response = await fetch(dictUrl);
	console.log('[LOAD] Response status:', response.status);

	if (!response.ok) {
		console.log(`[LOAD] Word "${word}" not found directly, trying deinflection...`);

		// Try deinflection (handles Japanese conjugation and Korean particles)
		const deinflectionResults = await findWordsWithDeinflection(word, fetch);

		if (deinflectionResults?.primary) {
			const { dictionaryForm, conjugationInfo } = deinflectionResults.primary;
			console.log(`[LOAD] Found deinflected form: "${dictionaryForm}" (${conjugationInfo})`);

			// Redirect to the dictionary form with conjugation info
			const redirectUrl = new URL(`/${encodeURIComponent(dictionaryForm)}`, url.origin);
			redirectUrl.searchParams.set('from', word);
			redirectUrl.searchParams.set('conj', conjugationInfo);

			// Include alternatives if any
			if (deinflectionResults.alternatives && deinflectionResults.alternatives.length > 0) {
				const altData = deinflectionResults.alternatives.map(alt => ({
					word: alt.dictionaryForm,
					conj: alt.conjugationInfo
				}));
				redirectUrl.searchParams.set('alt', JSON.stringify(altData));
			}

			// Redirect must be thrown outside of try-catch to work properly
			throw redirect(307, redirectUrl.pathname + redirectUrl.search);
		}

		console.error(`Failed to load "${word}" and no deinflection found`);
		throw error(404, `Character "${word}" not found`);
	}

	try {

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
			const redirectUrl = await getDictionaryUrl(data.redirect, dev, fetch);
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

		// Load character glosses (unique English keywords from chinese-word-game)
		let charGlosses: CharGlosses = {};
		try {
			const glossesResponse = await fetch('/game_data/component_glosses.json');
			if (glossesResponse.ok) {
				charGlosses = await glossesResponse.json();
			}
		} catch (err) {
			console.error('Failed to load character glosses:', err);
		}

		// Load character taxonomy (category hierarchy from chinese-word-game)
		let charTaxonomy: CharTaxonomy = {};
		try {
			const taxonomyResponse = await fetch('/game_data/char_taxonomy.json');
			if (taxonomyResponse.ok) {
				charTaxonomy = await taxonomyResponse.json();
			}
		} catch (err) {
			console.error('Failed to load character taxonomy:', err);
		}

		// Load component uses data (shows which characters use this one as a component)
		let componentUses: ComponentUsesMap = {};
		try {
			const componentUsesResponse = await fetch('/game_data/component_uses.json');
			if (componentUsesResponse.ok) {
				componentUses = await componentUsesResponse.json();
			}
		} catch (err) {
			console.error('Failed to load component uses:', err);
		}

		return {
			word,
			data,
			labels,
			charGlosses,
			charTaxonomy,
			componentUses,
			conjugatedFrom,
			conjugationInfo,
			conjugationAlternatives
		};
	} catch (err) {
		console.error(`Failed to load dictionary entry for "${word}":`, err);
		throw error(404, `Character "${word}" not found`);
	}
};

