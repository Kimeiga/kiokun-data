/**
 * Utilities for determining which shard a word belongs to
 * and constructing the appropriate jsDelivr CDN URL or local path
 */

import { dev } from '$app/environment';

export type ShardType = 'non-han' | 'han-1char' | 'han-2char' | 'han-3plus';

/**
 * Check if a character is a Han character (CJK Unified Ideographs)
 */
function isHanCharacter(char: string): boolean {
	const code = char.charCodeAt(0);
	return (
		(code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
		(code >= 0x3400 && code <= 0x4dbf) || // CJK Unified Ideographs Extension A
		(code >= 0x20000 && code <= 0x2a6df) || // CJK Unified Ideographs Extension B
		(code >= 0x2a700 && code <= 0x2b73f) || // CJK Unified Ideographs Extension C
		(code >= 0x2b740 && code <= 0x2b81f) || // CJK Unified Ideographs Extension D
		(code >= 0x2b820 && code <= 0x2ceaf) || // CJK Unified Ideographs Extension E
		(code >= 0x2ceb0 && code <= 0x2ebef) || // CJK Unified Ideographs Extension F
		(code >= 0x30000 && code <= 0x3134f) // CJK Unified Ideographs Extension G
	);
}

/**
 * Count the number of Han characters in a string
 */
function countHanCharacters(text: string): number {
	let count = 0;
	for (const char of text) {
		if (isHanCharacter(char)) {
			count++;
		}
	}
	return count;
}

/**
 * Determine which shard a word belongs to based on Han character count
 */
export function getShardForWord(word: string): ShardType {
	const hanCount = countHanCharacters(word);

	if (hanCount === 0) return 'non-han';
	if (hanCount === 1) return 'han-1char';
	if (hanCount === 2) return 'han-2char';
	return 'han-3plus';
}

/**
 * Get the GitHub repository name for a shard
 */
export function getRepoForShard(shard: ShardType): string {
	return `Kimeiga/kiokun-dict-${shard}`;
}

/**
 * Construct Cloudflare R2 CDN URL for a word
 * @param word - The word/character to fetch
 * @param shard - Optional shard type (will be auto-detected if not provided)
 * @returns The R2 CDN URL
 */
export function getR2Url(word: string, shard?: ShardType): string {
	const shardType = shard || getShardForWord(word);
	// R2 bucket is served via custom domain with Cloudflare CDN
	return `https://dict.kiokun.dev/${shardType}/${word}.json`;
}

/**
 * Get the URL for a word - uses local files in dev, R2 CDN in production
 * @param word - The word/character to fetch
 * @returns The URL to fetch from
 */
export function getDictionaryUrl(word: string): string {
	if (dev) {
		// Development: use local files
		return `/dictionary/${word}.json`;
	} else {
		// Production: use Cloudflare R2 CDN
		return getR2Url(word);
	}
}

/**
 * Fetch dictionary data from jsDelivr CDN
 * @param word - The word/character to fetch
 * @param fetchFn - The fetch function to use (allows passing SvelteKit's fetch)
 * @returns The dictionary data
 */
export async function fetchFromJsDelivr(word: string, fetchFn: typeof fetch = fetch) {
	const url = getJsDelivrUrl(word);
	const response = await fetchFn(url);

	if (!response.ok) {
		throw new Error(`Failed to fetch ${word} from jsDelivr: ${response.statusText}`);
	}

	return response.json();
}

