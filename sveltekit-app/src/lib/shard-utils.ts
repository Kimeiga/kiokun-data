/**
 * Utilities for determining which shard a word belongs to
 * and constructing the appropriate jsDelivr CDN URL or local path
 *
 * 23-shard system optimized for GitHub deployment (each under 20K files)
 */

import { dev } from '$app/environment';

export type ShardType =
	| 'non-han-non-kana'
	| 'kana-only-1'
	| 'kana-only-2'
	| 'han1-len1-1'
	| 'han1-len1-2'
	| 'han1-len1-3'
	| 'han1-len1-4'
	| 'han1-len2'
	| 'han1-len3'
	| 'han1-len4plus'
	| 'han2-len2-4e5f-1'
	| 'han2-len2-4e5f-2'
	| 'han2-len2-607f-1'
	| 'han2-len2-607f-2'
	| 'han2-len2-809f-1'
	| 'han2-len2-809f-2'
	| 'han2-len3'
	| 'han2-len4'
	| 'han2-len5plus'
	| 'han3-len3-1'
	| 'han3-len3-2'
	| 'han3-len4'
	| 'han3-len5'
	| 'han3-len6plus'
	| 'han4plus-1'
	| 'han4plus-2'
	| 'han4plus-3';

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
 * Check if a character is kana (hiragana or katakana)
 */
function isKana(char: string): boolean {
	const code = char.charCodeAt(0);
	return (code >= 0x3040 && code <= 0x309f) || // Hiragana
		(code >= 0x30a0 && code <= 0x30ff); // Katakana
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
 * Check if string contains any kana
 */
function hasKana(text: string): boolean {
	for (const char of text) {
		if (isKana(char)) {
			return true;
		}
	}
	return false;
}

/**
 * Simple hash function for consistent distribution (matches Rust implementation)
 */
function simpleHash(s: string): number {
	let hash = 0;
	for (let i = 0; i < s.length; i++) {
		hash = ((hash * 31) + s.charCodeAt(i)) >>> 0; // >>> 0 converts to unsigned 32-bit
	}
	return hash;
}

/**
 * Determine which shard a word belongs to based on Han character count, length, and Unicode range
 * This MUST match the Rust implementation in src/main.rs
 */
export function getShardForWord(word: string): ShardType {
	const hanCount = countHanCharacters(word);
	const totalLen = word.length;
	const hasKanaChars = hasKana(word);

	if (hanCount === 0) {
		if (!hasKanaChars) {
			return 'non-han-non-kana';
		} else {
			// Kana-only: split by first character
			const firstChar = word.charCodeAt(0);
			// Hiragana (U+3040-U+309F) or Katakana ア-ゴ (U+30A1-U+30B4) → shard 1
			// Katakana サ-ワ (U+30B5-U+30FF) → shard 2
			if (firstChar <= 0x30b4) {
				return 'kana-only-1';
			} else {
				return 'kana-only-2';
			}
		}
	} else if (hanCount === 1) {
		if (totalLen === 1) {
			// Han1-len1: Use hash-based distribution for even split
			const hash = simpleHash(word);
			const bucket = hash % 4;
			if (bucket === 0) return 'han1-len1-1';
			if (bucket === 1) return 'han1-len1-2';
			if (bucket === 2) return 'han1-len1-3';
			return 'han1-len1-4';
		} else if (totalLen === 2) {
			return 'han1-len2';
		} else if (totalLen === 3) {
			return 'han1-len3';
		} else {
			return 'han1-len4plus';
		}
	} else if (hanCount === 2) {
		if (totalLen === 2) {
			// Han2-len2: Split by Unicode range of first Han character
			let firstHanCode = 0;
			for (const char of word) {
				if (isHanCharacter(char)) {
					firstHanCode = char.charCodeAt(0);
					break;
				}
			}

			const hash = simpleHash(word);
			const isFirstHalf = hash % 2 === 0;

			if (firstHanCode >= 0x4e00 && firstHanCode <= 0x5fff) {
				return isFirstHalf ? 'han2-len2-4e5f-1' : 'han2-len2-4e5f-2';
			} else if (firstHanCode >= 0x6000 && firstHanCode <= 0x7fff) {
				return isFirstHalf ? 'han2-len2-607f-1' : 'han2-len2-607f-2';
			} else {
				// 0x8000-0x9FFF and others
				return isFirstHalf ? 'han2-len2-809f-1' : 'han2-len2-809f-2';
			}
		} else if (totalLen === 3) {
			return 'han2-len3';
		} else if (totalLen === 4) {
			return 'han2-len4';
		} else {
			return 'han2-len5plus';
		}
	} else if (hanCount === 3) {
		if (totalLen === 3) {
			// Han3-len3: Hash-based split
			const hash = simpleHash(word);
			return hash % 2 === 0 ? 'han3-len3-1' : 'han3-len3-2';
		} else if (totalLen === 4) {
			return 'han3-len4';
		} else if (totalLen === 5) {
			return 'han3-len5';
		} else {
			return 'han3-len6plus';
		}
	} else {
		// Han4+: Hash-based distribution
		const hash = simpleHash(word);
		const bucket = hash % 3;
		if (bucket === 0) return 'han4plus-1';
		if (bucket === 1) return 'han4plus-2';
		return 'han4plus-3';
	}
}

/**
 * Get the GitHub repository name for a shard
 */
export function getRepoForShard(shard: ShardType): string {
	return `Kimeiga/kiokun-dict-${shard}`;
}

/**
 * Construct jsDelivr CDN URL for a word
 * @param word - The word/character to fetch
 * @param shard - Optional shard type (will be auto-detected if not provided)
 * @returns The jsDelivr CDN URL
 */
export function getJsDelivrUrl(word: string, shard?: ShardType): string {
	const shardType = shard || getShardForWord(word);
	const repo = getRepoForShard(shardType);
	return `https://cdn.jsdelivr.net/gh/${repo}@latest/${word}.json`;
}

/**
 * Get the URL for a word - uses local files in dev, jsDelivr CDN in production
 * @param word - The word/character to fetch
 * @returns The URL to fetch from
 */
export function getDictionaryUrl(word: string): string {
	if (dev) {
		// Development: use local files
		return `/dictionary/${word}.json`;
	} else {
		// Production: use jsDelivr CDN
		return getJsDelivrUrl(word);
	}
}

