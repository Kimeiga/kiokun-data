import type { PageLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getDictionaryUrl } from '$lib/shard-utils';
import { dev } from '$app/environment';
import { decompressSync, strFromU8 } from 'fflate';
import type { DictionaryEntry, SemanticMnemonicCard } from '$lib/types';
import { findWordsWithDeinflection } from '$lib/utils/search-navigation';

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

async function fetchDictionaryEntry(word: string, fetchFn: typeof fetch): Promise<DictionaryEntry | null> {
	const dictUrl = await getDictionaryUrl(word, dev, fetchFn);
	const dictFetch = dictUrl.startsWith('http') ? globalThis.fetch : fetchFn;
	const response = await dictFetch(dictUrl);
	if (!response.ok) return null;
	return decompressAndParse(await response.arrayBuffer());
}

function addEntryMnemonicCandidates(entry: DictionaryEntry | null | undefined, candidates: Set<string>) {
	if (!entry) return;
	const add = (char: unknown) => {
		if (typeof char === 'string' && [...char].length === 1) candidates.add(char);
	};

	add(entry.key);
	add(entry.simplified_form_of);
	add(entry.chinese_char?.char);
	add(entry.chinese_char?.hkChar);
	for (const char of entry.chinese_char?.simpVariants || []) add(char);
	for (const char of entry.chinese_char?.tradVariants || []) add(char);
	add(entry.japanese_char?.literal);
	add(entry.korean_char?.character);
	add(entry.korean_char?.hanjaForm);
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
	simplifiedCharData?: any; // Preloaded simplified variant's chinese_char data (for equation comparison)
	labels: JapaneseLabels;
	charGlosses: CharGlosses;
	charTaxonomy: CharTaxonomy;
	componentUses: ComponentUsesMap;
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

	console.log('[LOAD] Starting load for word:', word);

	// Fetch the compressed dictionary data
	// Use globalThis.fetch for external binary URLs to avoid SvelteKit's fetch wrapper
	// which can corrupt ArrayBuffer data during client-side navigation (popstate)
	const dictUrl = await getDictionaryUrl(word, dev, fetch);
	console.log('[LOAD] Fetching URL:', dictUrl);
	const dictFetch = dictUrl.startsWith('http') ? globalThis.fetch : fetch;
	const response = await dictFetch(dictUrl);
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

		// Try custom word lookup as last resort
		console.log(`[LOAD] Trying custom word lookup for "${word}"...`);
		try {
			const customResp = await fetch(`/api/custom-words/by-word/${encodeURIComponent(word)}`);
			if (customResp.ok) {
				const customWord = await customResp.json();
				console.log(`[LOAD] Found custom word: "${word}"`);
				return {
					word,
					data: {} as DictionaryEntry,
					labels: {},
					charGlosses: {},
					charTaxonomy: {},
					componentUses: {},
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
			console.log(`[IMAGES] Found ${data.chinese_char.images.length} images for "${word}":`, data.chinese_char.images);
		} else {
			console.log(`[IMAGES] No images found for "${word}"`);
		}



		// If this is a redirect entry, fetch the actual data
		let redirectOriginal: DictionaryEntry | null = null;
		let redirectTargetMnemonic: SemanticMnemonicCard | null = null;
		if (data.redirect) {
			const original = data;
			redirectOriginal = original;
			const originalMnemonic = original.semantic_mnemonic;
			const redirectUrl = await getDictionaryUrl(data.redirect, dev, fetch);
			const redirectFetch = redirectUrl.startsWith('http') ? globalThis.fetch : fetch;
			const redirectResponse = await redirectFetch(redirectUrl);
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
						const vFetch = vUrl.startsWith('http') ? globalThis.fetch : fetch;
						const vResp = await vFetch(vUrl);
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

		// Preload simplified character data if different from traditional, so the page
		// can show separate character equations when components differ. This runs on
		// both server and client, ensuring the data is available during the initial render.
		// If the simplified entry has no chinese_char components of its own, fall back to
		// parsing its japanese_char.ids (IDS) as a synthetic component list.
		let simplifiedCharData: any = null;
		const simpChar = (data.chinese_char as any)?.simpVariants?.[0];
		const tradCharField = (data.chinese_char as any)?.char;
		if (simpChar && tradCharField && simpChar !== tradCharField) {
			try {
				const simpUrl = await getDictionaryUrl(simpChar, dev, fetch);
				const simpFetch = simpUrl.startsWith('http') ? globalThis.fetch : fetch;
				const simpResponse = await simpFetch(simpUrl);
				if (simpResponse.ok) {
					const simpCompressed = await simpResponse.arrayBuffer();
					const simpData = decompressAndParse(simpCompressed);
					simplifiedCharData = simpData.chinese_char || null;

					// Fallback: if the simp entry has no chinese_char components of
					// its own (common for simplified chars that redirect, e.g. 发),
					// derive synthetic components from an IDS string. Prefer the
					// simplified char's OWN chinese_char.ids, then japanese_char.ids.
					if (!simplifiedCharData || !simplifiedCharData.components || simplifiedCharData.components.length === 0) {
						const ids =
							(simpData.chinese_char as any)?.ids ||
							(simpData.japanese_char as any)?.ids;
						if (ids) {
							// Strip entity refs (&CDP-…;, &GT-…;, &U+…;) and IDC
							// description operators (U+2FF0–U+2FFB); keep real glyphs.
							const cleaned = ids.replace(/&[^;]+;/g, '');
							const chars: string[] = [];
							for (const ch of cleaned) {
								const code = ch.codePointAt(0) || 0;
								if (code >= 0x2FF0 && code <= 0x2FFB) continue;
								if (ch.trim()) chars.push(ch);
							}
							if (chars.length > 0) {
								simplifiedCharData = {
									...(simplifiedCharData || {}),
									char: simpChar,
									components: chars.map(c => ({ character: c, type: [] })),
								};
							}
						}
					}
				}
			} catch (err) {
				console.error(`[LOAD] Failed to fetch simplified char ${simpChar}:`, err);
			}
		}

		// Collect mnemonic cards for visually different character variants. The exact
		// dictionary entry only carries one card, but merged entries like 买/買 need
		// separate learner stories when the written forms decompose differently.
		const mnemonicCandidates = new Set<string>();
		addEntryMnemonicCandidates(data, mnemonicCandidates);
		addEntryMnemonicCandidates(redirectOriginal, mnemonicCandidates);
		if (simplifiedCharData?.char) {
			mnemonicCandidates.add(simplifiedCharData.char);
		}

		const variantMnemonicCards: SemanticMnemonicCard[] = [];
		const seenMnemonicChars = new Set<string>();
		const addMnemonicCard = (card: SemanticMnemonicCard | null | undefined) => {
			if (!card || seenMnemonicChars.has(card.character)) return;
			seenMnemonicChars.add(card.character);
			variantMnemonicCards.push(card);
		};

		addMnemonicCard(data.semantic_mnemonic);
		addMnemonicCard(redirectOriginal?.semantic_mnemonic);
		addMnemonicCard(redirectTargetMnemonic);

		for (const candidate of mnemonicCandidates) {
			if (seenMnemonicChars.has(candidate)) continue;
			try {
				const candidateEntry =
					candidate === data.key
						? data
						: candidate === redirectOriginal?.key
							? redirectOriginal
							: await fetchDictionaryEntry(candidate, fetch);
				addMnemonicCard(candidateEntry?.semantic_mnemonic);
			} catch {
				// Variant entries are helpful but not required for the page.
			}
		}

		if (!data.semantic_mnemonic && variantMnemonicCards.length > 0) {
			data.semantic_mnemonic = variantMnemonicCards[0];
		}
		data.semantic_mnemonic_variants = variantMnemonicCards.filter(
			(card) => card.character !== data.semantic_mnemonic?.character
		);

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
			simplifiedCharData,
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
