export const REEL_SHARD_COUNT = 256;

/**
 * Stable FNV-1a hash shared by the reel-index generator and the browser.
 * Iterating code points keeps supplementary CJK characters deterministic.
 */
export function reelShardForWord(word: string): string {
	let hash = 0x811c9dc5;

	for (const character of word) {
		hash ^= character.codePointAt(0) ?? 0;
		hash = Math.imul(hash, 0x01000193);
	}

	return ((hash >>> 0) % REEL_SHARD_COUNT).toString(16).padStart(2, '0');
}
