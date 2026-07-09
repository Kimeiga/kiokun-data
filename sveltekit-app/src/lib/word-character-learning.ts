import { dev } from '$app/environment';
import { getDictionaryUrl } from '$lib/shard-utils';
import {
	buildCharacterSupportData,
	type CharacterSupportData,
	type CharacterSupportSource
} from '$lib/character-support';
import type { DictionaryEntry, SemanticMnemonicCard } from '$lib/types';
import { decompressSync, strFromU8 } from 'fflate';

export interface CharacterLearningData {
	simplifiedCharData: any;
	mnemonicCards: SemanticMnemonicCard[];
	support: CharacterSupportData;
}

export function emptyCharacterLearningData(): CharacterLearningData {
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

function decompressAndParse(compressedData: ArrayBuffer): DictionaryEntry {
	const decompressed = decompressSync(new Uint8Array(compressedData));
	return JSON.parse(strFromU8(decompressed)) as DictionaryEntry;
}

function fetchDictionaryBytes(url: string, fetchFn: typeof fetch): Promise<Response> {
	if (typeof window !== 'undefined' || url.startsWith('http')) {
		return globalThis.fetch(url);
	}
	return fetchFn(url);
}

async function fetchDictionaryEntry(word: string, fetchFn: typeof fetch): Promise<DictionaryEntry | null> {
	const dictUrl = await getDictionaryUrl(word, dev, fetchFn);
	const response = await fetchDictionaryBytes(dictUrl, fetchFn);
	if (!response.ok) return null;
	return decompressAndParse(await response.arrayBuffer());
}

function isCapacitorRuntime(): boolean {
	return typeof window !== 'undefined' && window.location.protocol === 'capacitor:';
}

let staticSupportSourcePromise: Promise<CharacterSupportSource> | null = null;

async function fetchStaticJson<T>(path: string, pageUrl: URL): Promise<T> {
	const response = await globalThis.fetch(new URL(path, pageUrl.origin));
	if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
	return response.json() as Promise<T>;
}

async function getStaticSupportSource(pageUrl: URL): Promise<CharacterSupportSource> {
	staticSupportSourcePromise ??= Promise.all([
		fetchStaticJson<Record<string, string>>('/game_data/component_glosses.json', pageUrl),
		fetchStaticJson<Record<string, string[]>>('/game_data/char_taxonomy.json', pageUrl),
		fetchStaticJson<CharacterSupportSource['componentUses']>('/game_data/component_uses.json', pageUrl)
	]).then(([charGlosses, charTaxonomy, componentUses]) => ({
		charGlosses,
		charTaxonomy,
		componentUses
	}));

	return staticSupportSourcePromise;
}

async function fetchCharacterSupport(
	chars: Set<string>,
	components: Set<string>,
	fetchFn: typeof fetch,
	pageUrl: URL
): Promise<CharacterSupportData> {
	if (!isCapacitorRuntime()) {
		try {
			const params = new URLSearchParams();
			for (const char of [...chars].filter(Boolean).sort()) params.append('char', char);
			for (const component of [...components].filter(Boolean).sort()) params.append('component', component);
			const response = await fetchFn(`/api/character-support?${params.toString()}`);
			if (response.ok) return response.json();
		} catch (err) {
			console.error('Failed to load character support API:', err);
		}
	}

	const source = await getStaticSupportSource(pageUrl);
	return buildCharacterSupportData(source, { chars, components });
}

function componentChar(component: any): string | null {
	if (!component) return null;
	if (typeof component === 'string') return component;
	return component.character || component.char || null;
}

function addSupportChar(chars: Set<string>, value: unknown): void {
	if (typeof value === 'string' && value) chars.add(value);
}

function addGlyphs(chars: Set<string>, value: unknown): void {
	if (typeof value !== 'string') return;
	for (const char of value) {
		if (char.trim()) chars.add(char);
	}
}

function addSupportComponent(chars: Set<string>, components: Set<string>, component: any): void {
	const char = componentChar(component);
	if (char) {
		chars.add(char);
		components.add(char);
	}
	addSupportChar(chars, component?.originalCharacter);
}

function addComponents(chars: Set<string>, components: Set<string>, values: any[] | undefined | null): void {
	for (const component of values || []) {
		addSupportComponent(chars, components, component);
	}
}

function addMnemonicSupport(chars: Set<string>, components: Set<string>, card: SemanticMnemonicCard | null | undefined): void {
	if (!card) return;
	addSupportChar(chars, card.character);
	addComponents(chars, components, card.components as any[]);
	addComponents(chars, components, card.visual_components as any[]);
	addComponents(chars, components, card.historical_components as any[]);
}

function parseIdsComponents(ids: string | undefined | null): string[] {
	if (!ids) return [];
	const cleaned = ids.replace(/&[^;]+;/g, '');
	const chars: string[] = [];
	for (const ch of cleaned) {
		const code = ch.codePointAt(0) || 0;
		if (code >= 0x2ff0 && code <= 0x2ffb) continue;
		if (ch.trim()) chars.push(ch);
	}
	return chars;
}

function collectSupportKeys(
	word: string,
	data: DictionaryEntry,
	simplifiedCharData: any,
	redirectOriginal: DictionaryEntry | null,
	mnemonicCards: SemanticMnemonicCard[]
): { chars: Set<string>; components: Set<string> } {
	const chars = new Set<string>();
	const components = new Set<string>();

	addGlyphs(chars, word);
	addSupportChar(chars, data.key);
	addSupportChar(chars, data.redirect);
	addSupportChar(chars, data.chinese_char?.char);
	addSupportChar(chars, data.chinese_char?.hkChar);
	for (const variant of data.chinese_char?.simpVariants || []) addSupportChar(chars, variant);
	for (const variant of data.chinese_char?.tradVariants || []) addSupportChar(chars, variant);
	addSupportChar(chars, data.japanese_char?.literal);
	addSupportChar(chars, data.korean_char?.character);
	addSupportChar(chars, data.korean_char?.hanjaForm);

	addSupportChar(chars, redirectOriginal?.key);
	addSupportChar(chars, redirectOriginal?.chinese_char?.char);
	for (const variant of redirectOriginal?.chinese_char?.simpVariants || []) addSupportChar(chars, variant);
	for (const variant of redirectOriginal?.chinese_char?.tradVariants || []) addSupportChar(chars, variant);

	addComponents(chars, components, data.chinese_char?.components as any[]);
	addComponents(chars, components, simplifiedCharData?.components as any[]);
	for (const char of parseIdsComponents((data.japanese_char as any)?.ids)) chars.add(char);

	for (const card of mnemonicCards) addMnemonicSupport(chars, components, card);

	for (const preview of data.contains || []) {
		addSupportChar(chars, (preview as any).w);
		for (const form of (preview as any).forms || []) addSupportChar(chars, form);
	}

	return { chars, components };
}

function isCompatibilityIdeograph(char: string): boolean {
	const codepoint = char.codePointAt(0) ?? 0;
	return (codepoint >= 0xf900 && codepoint <= 0xfaff) ||
		(codepoint >= 0x2f800 && codepoint <= 0x2fa1f);
}

const MNEMONIC_CANDIDATE_DENYLIST: Record<string, Set<string>> = {
	里: new Set(['裡'])
};

function addEntryMnemonicCandidates(entry: DictionaryEntry | null | undefined, candidates: Set<string>) {
	if (!entry) return;
	const denied = MNEMONIC_CANDIDATE_DENYLIST[entry.key];
	const add = (char: unknown) => {
		if (
			typeof char === 'string' &&
			[...char].length === 1 &&
			!isCompatibilityIdeograph(char) &&
			!denied?.has(char)
		) {
			candidates.add(char);
		}
	};

	add(entry.key);
	add(entry.redirect);
	add(entry.chinese_char?.char);
	add(entry.chinese_char?.hkChar);
	add(entry.chinese_char?.simpVariants?.[0]);
	add(entry.chinese_char?.tradVariants?.[0]);
	add(entry.japanese_char?.literal);
	add(entry.korean_char?.character);
	add(entry.korean_char?.hanjaForm);
}

async function fetchSimplifiedCharacterData(
	data: DictionaryEntry,
	fetchFn: typeof fetch
): Promise<{ simplifiedCharData: any; simplifiedEntry: DictionaryEntry | null }> {
	let simplifiedCharData: any = null;
	let simplifiedEntry: DictionaryEntry | null = null;
	const simpChar = (data.chinese_char as any)?.simpVariants?.[0];
	const tradCharField = (data.chinese_char as any)?.char;
	if (!simpChar || !tradCharField || simpChar === tradCharField) {
		return { simplifiedCharData, simplifiedEntry };
	}

	const simpEntry = await fetchDictionaryEntry(simpChar, fetchFn);
	if (!simpEntry) return { simplifiedCharData, simplifiedEntry };

	simplifiedEntry = simpEntry;
	simplifiedCharData = simpEntry.chinese_char || null;

	if (!simplifiedCharData?.components?.length) {
		const ids = (simpEntry.chinese_char as any)?.ids || (simpEntry.japanese_char as any)?.ids;
		const chars = parseIdsComponents(ids);
		if (chars.length > 0) {
			simplifiedCharData = {
				...(simplifiedCharData || {}),
				char: simpChar,
				components: chars.map((char) => ({ character: char, type: [] }))
			};
		}
	}

	return { simplifiedCharData, simplifiedEntry };
}

async function buildVariantMnemonicCards(
	data: DictionaryEntry,
	redirectOriginal: DictionaryEntry | null,
	redirectTargetMnemonic: SemanticMnemonicCard | null,
	simplifiedCharData: any,
	simplifiedEntry: DictionaryEntry | null,
	fetchFn: typeof fetch
): Promise<SemanticMnemonicCard[]> {
	const mnemonicCandidates = new Set<string>();
	addEntryMnemonicCandidates(data, mnemonicCandidates);
	addEntryMnemonicCandidates(redirectOriginal, mnemonicCandidates);
	if (simplifiedCharData?.char) mnemonicCandidates.add(simplifiedCharData.char);

	const variantMnemonicCards: SemanticMnemonicCard[] = [];
	const seenMnemonicChars = new Set<string>();
	const addMnemonicCard = (card: SemanticMnemonicCard | null | undefined) => {
		if (!card || seenMnemonicChars.has(card.character)) return;
		seenMnemonicChars.add(card.character);
		variantMnemonicCards.push(card);
	};

	addMnemonicCard(data.semantic_mnemonic);
	for (const card of data.semantic_mnemonic_variants || []) addMnemonicCard(card);
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
						: candidate === simplifiedEntry?.key
							? simplifiedEntry
							: await fetchDictionaryEntry(candidate, fetchFn);
			addMnemonicCard(candidateEntry?.semantic_mnemonic);
		} catch {
			// Variant entries are helpful but not required for the page.
		}
	}

	return variantMnemonicCards;
}

export async function buildCharacterLearningData({
	word,
	data,
	redirectOriginal,
	redirectTargetMnemonic,
	fetchFn,
	pageUrl
}: {
	word: string;
	data: DictionaryEntry;
	redirectOriginal: DictionaryEntry | null;
	redirectTargetMnemonic: SemanticMnemonicCard | null;
	fetchFn: typeof fetch;
	pageUrl: URL;
}): Promise<CharacterLearningData> {
	let simplifiedCharData: any = null;
	let simplifiedEntry: DictionaryEntry | null = null;

	try {
		({ simplifiedCharData, simplifiedEntry } = await fetchSimplifiedCharacterData(data, fetchFn));
	} catch (err) {
		console.error('[LOAD] Failed to load simplified character learning data:', err);
	}

	let mnemonicCards: SemanticMnemonicCard[] = [];
	try {
		mnemonicCards = await buildVariantMnemonicCards(
			data,
			redirectOriginal,
			redirectTargetMnemonic,
			simplifiedCharData,
			simplifiedEntry,
			fetchFn
		);
	} catch (err) {
		console.error('[LOAD] Failed to load mnemonic variants:', err);
	}

	try {
		const supportKeys = collectSupportKeys(
			word,
			data,
			simplifiedCharData,
			redirectOriginal,
			mnemonicCards
		);
		const support = await fetchCharacterSupport(
			supportKeys.chars,
			supportKeys.components,
			fetchFn,
			pageUrl
		);

		return { simplifiedCharData, mnemonicCards, support };
	} catch (err) {
		console.error('[LOAD] Failed to load character support:', err);
		return { simplifiedCharData, mnemonicCards, support: emptyCharacterLearningData().support };
	}
}
