import type { PageLoad } from './$types';
import { getDictionaryUrl } from '$lib/shard-utils';
import { dev } from '$app/environment';
import { decompressSync, strFromU8 } from 'fflate';
import type { DictionaryEntry } from '$lib/types';

// SSR enabled: fetches static JSON + GitHub CDN, both work server-side

interface ComponentUsesEntry {
	chars: string[];
	count: number;
	verified: number;
}

interface ComponentUsesMap {
	[char: string]: {
		[componentType: string]: ComponentUsesEntry;
	};
}

interface CharGlosses {
	[char: string]: string;
}

export interface PhoneticCharInfo {
	char: string;
	pinyin: string[];
	gloss: string;
}

export interface PhoneticPageData {
	component: string;
	componentGloss: string;
	characters: PhoneticCharInfo[];
}

function decompressAndParse(compressedData: ArrayBuffer): DictionaryEntry {
	const uint8Array = new Uint8Array(compressedData);
	const decompressed = decompressSync(uint8Array);
	const jsonString = strFromU8(decompressed);
	return JSON.parse(jsonString) as DictionaryEntry;
}

export const load: PageLoad<PhoneticPageData> = async ({ params, fetch }) => {
	const { char } = params;

	// Fetch component data
	const [usesResponse, glossesResponse] = await Promise.all([
		fetch('/game_data/component_uses.json'),
		fetch('/game_data/component_glosses.json')
	]);

	const componentUses: ComponentUsesMap = usesResponse.ok ? await usesResponse.json() : {};
	const charGlosses: CharGlosses = glossesResponse.ok ? await glossesResponse.json() : {};

	const componentGloss = charGlosses[char] || '';

	// Get characters that use this char as a sound/phonetic component
	const soundData = componentUses[char]?.sound || componentUses[char]?.phonetic;
	const soundChars = soundData?.chars || [];

	// Limit to first 30 characters to avoid too many fetches
	const limitedChars = soundChars.slice(0, 30);

	// Fetch dictionary entries for each character to get pinyin readings
	const characters: PhoneticCharInfo[] = await Promise.all(
		limitedChars.map(async (c: string): Promise<PhoneticCharInfo> => {
			const gloss = charGlosses[c] || '';
			try {
				const dictUrl = await getDictionaryUrl(c, dev, fetch);
				const response = await fetch(dictUrl);
				if (response.ok) {
					const compressedData = await response.arrayBuffer();
					let data = decompressAndParse(compressedData);
					if (data.redirect) {
						const redirectUrl = await getDictionaryUrl(data.redirect, dev, fetch);
						const redirectResponse = await fetch(redirectUrl);
						if (redirectResponse.ok) {
							const redirectCompressed = await redirectResponse.arrayBuffer();
							data = decompressAndParse(redirectCompressed);
						}
					}
					const pinyin = data.chinese_char?.pinyinFrequencies?.map(pf => pf.pinyin) || [];
					return { char: c, pinyin, gloss };
				}
			} catch (err) {
				console.error(`Failed to fetch dictionary entry for "${c}":`, err);
			}
			return { char: c, pinyin: [], gloss };
		})
	);

	return {
		component: char,
		componentGloss,
		characters
	};
};
