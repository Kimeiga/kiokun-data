import type { PageLoad } from './$types';
import { error, isHttpError, isRedirect, redirect } from '@sveltejs/kit';
import { getDictionaryUrl } from '$lib/shard-utils';
import { dev } from '$app/environment';
import { decompressSync, strFromU8 } from 'fflate';
import type { DictionaryEntry, SemanticMnemonicCard } from '$lib/types';
import type { CharacterLearningData } from '$lib/word-character-learning';

// SSR works in production (fetches GitHub CDN) but can cause issues in dev
// where the CORS proxy may not be reachable from the server process.
// We use prerender = false (default) and let SSR run normally.

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

function fetchDictionaryBytes(url: string, fetchFn: typeof fetch): Promise<Response> {
	if (typeof window !== 'undefined' || url.startsWith('http')) {
		return globalThis.fetch(url);
	}
	return fetchFn(url);
}

function unavailableDictionaryStatus(status: number): number {
	if (status === 429) return 503;
	if (status >= 500) return 502;
	return status;
}

function throwDictionaryUnavailable(word: string, status: number): never {
	throw error(
		unavailableDictionaryStatus(status),
		`Dictionary source unavailable for "${word}" (${status})`
	);
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

function emptyCharacterLearningData(): CharacterLearningData {
	return {
		simplifiedCharData: null,
		mnemonicCards: [],
		support: {
			charGlosses: {},
			charTaxonomy: {},
			componentUses: {}
		}
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
	simplifiedCharData?: any; // Preloaded simplified variant's chinese_char data (for equation comparison)
	charGlosses: CharGlosses;
	charTaxonomy: CharTaxonomy;
	componentUses: ComponentUsesMap;
	characterLearningData: Promise<CharacterLearningData>;
	// Conjugation info (passed via URL params when arriving from deinflection)
	conjugatedFrom?: string;  // The original conjugated word
	conjugationInfo?: string; // Human-readable conjugation description
	conjugationAlternatives?: ConjugationAlternative[]; // Other possible matches
	// Custom word (user-created dictionary entry)
	customWord?: any;
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

	if (dev) console.log('[LOAD] Starting load for word:', word);

	// Fetch the compressed dictionary data
	// Use globalThis.fetch for external binary URLs to avoid SvelteKit's fetch wrapper
	// which can corrupt ArrayBuffer data during client-side navigation (popstate)
	const dictUrl = await getDictionaryUrl(word, dev, fetch);
	if (dev) console.log('[LOAD] Fetching URL:', dictUrl);
	const response = await fetchDictionaryBytes(dictUrl, fetch);
	if (dev) console.log('[LOAD] Response status:', response.status);

	if (!response.ok) {
		if (response.status !== 404) {
			throwDictionaryUnavailable(word, response.status);
		}

		if (dev) console.log(`[LOAD] Word "${word}" not found directly, trying deinflection...`);

		// Try deinflection (handles Japanese conjugation and Korean particles)
		const { findWordsWithDeinflection } = await import('$lib/utils/search-navigation');
		const deinflectionResults = await findWordsWithDeinflection(word, fetch);

		if (deinflectionResults?.primary) {
			const { dictionaryForm, conjugationInfo } = deinflectionResults.primary;
			if (dev) console.log(`[LOAD] Found deinflected form: "${dictionaryForm}" (${conjugationInfo})`);

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

		// Try custom word lookup as last resort
		if (dev) console.log(`[LOAD] Trying custom word lookup for "${word}"...`);
		try {
			const customResp = await fetch(`/api/custom-words/by-word/${encodeURIComponent(word)}`);
			if (customResp.ok) {
				const customWord = await customResp.json();
				if (dev) console.log(`[LOAD] Found custom word: "${word}"`);
				return {
					word,
					data: {} as DictionaryEntry,
					charGlosses: {},
					charTaxonomy: {},
					componentUses: {},
					characterLearningData: Promise.resolve(emptyCharacterLearningData()),
					customWord,
					conjugatedFrom,
					conjugationInfo,
					conjugationAlternatives
				};
			}
		} catch {
			// Custom word lookup failed, continue to 404
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
			if (dev) console.log(`[IMAGES] Found ${data.chinese_char.images.length} images for "${word}":`, data.chinese_char.images);
		} else {
			if (dev) console.log(`[IMAGES] No images found for "${word}"`);
		}



		// If this is a redirect entry, fetch the actual data
		let redirectOriginal: DictionaryEntry | null = null;
		let redirectTargetMnemonic: SemanticMnemonicCard | null = null;
		if (data.redirect) {
			const original = data;
			redirectOriginal = original;
			const originalMnemonic = original.semantic_mnemonic;
			const redirectUrl = await getDictionaryUrl(data.redirect, dev, fetch);
			const redirectResponse = await fetchDictionaryBytes(redirectUrl, fetch);
			if (redirectResponse.ok) {
				const redirectCompressed = await redirectResponse.arrayBuffer();
				data = decompressAndParse(redirectCompressed);
				redirectTargetMnemonic = data.semantic_mnemonic || null;
				if (originalMnemonic) {
					data.semantic_mnemonic = originalMnemonic;
				}
			}

			// A simplified character can map to several traditional variants
			// (e.g. 当 → 噹 *and* 當). `redirect` only resolves one of them, so
			// the other variants' senses were being dropped. Merge chinese_words
			// from every traditional variant, deduped by _id. Only kicks in when
			// there is more than one variant, so single-redirect pages are
			// unaffected.
			const variants: string[] = (original.chinese_char as any)?.tradVariants ?? [];
			if (variants.length > 1) {
				const seen = new Set((data.chinese_words ?? []).map((w: any) => w._id));
				const merged: any[] = [...(data.chinese_words ?? [])];
				for (const v of variants) {
					if (v === data.redirect) continue; // already loaded as the base
					try {
						const vUrl = await getDictionaryUrl(v, dev, fetch);
						const vResp = await fetchDictionaryBytes(vUrl, fetch);
						if (!vResp.ok) continue;
						const vData = decompressAndParse(await vResp.arrayBuffer());
						for (const w of (vData.chinese_words ?? []) as any[]) {
							if (!seen.has(w._id)) {
								seen.add(w._id);
								merged.push(w);
							}
						}
					} catch {
						// A variant that fails to load just contributes nothing.
					}
				}
				data.chinese_words = merged;
			}
		}

		const characterLearningData = import('$lib/word-character-learning')
			.then(({ buildCharacterLearningData }) =>
				buildCharacterLearningData({
					word,
					data,
					redirectOriginal,
					redirectTargetMnemonic,
					fetchFn: fetch,
					pageUrl: url
				})
			)
			.catch((err) => {
				console.error('[LOAD] Failed to start character learning data load:', err);
				return emptyCharacterLearningData();
			});

		return {
			word,
			data,
			simplifiedCharData: null,
			charGlosses: {},
			charTaxonomy: {},
			componentUses: {},
			characterLearningData,
			conjugatedFrom,
			conjugationInfo,
			conjugationAlternatives
		};
	} catch (err) {
		if (isHttpError(err) || isRedirect(err)) {
			throw err;
		}
		console.error(`Failed to load dictionary entry for "${word}":`, err);
		throw error(404, `Character "${word}" not found`);
	}
};
