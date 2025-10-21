/**
 * Shard utilities for the Kiokun dictionary
 * 
 * This module handles the 10-shard distribution system that optimally distributes 
 * dictionary entries across GitHub repositories for fast jsDelivr CDN delivery.
 * 
 * ARCHITECTURE OVERVIEW:
 * ===================
 * The system uses 10 GitHub repositories (kiokun2-dict-*) to store ~435K dictionary files:
 * 
 * 1. non-han           : ~45K files (all non-Chinese: English, kana, etc.)
 * 2. han-1char-1       : ~45K files (single Han chars, hash split 1/2)  
 * 3. han-1char-2       : ~45K files (single Han chars, hash split 2/2)
 * 4. han-2char-1       : ~34K files (2-char words, hash split 1/3)
 * 5. han-2char-2       : ~34K files (2-char words, hash split 2/3) 
 * 6. han-2char-3       : ~34K files (2-char words, hash split 3/3)
 * 7. han-3plus-1       : ~32K files (3+ char words, hash split 1/3)
 * 8. han-3plus-2       : ~32K files (3+ char words, hash split 2/3)
 * 9. han-3plus-3       : ~32K files (3+ char words, hash split 3/3)
 * 10. reserved         : Empty (for future growth)
 * 
 * PERFORMANCE BENEFITS:
 * - Each repo under jsDelivr's 50MB limit (individual files work perfectly)
 * - 61% faster deployment (1m16s vs 3m12s for old 23-shard system)
 * - All shards deploy in parallel (no batching needed)
 * - Global CDN distribution via jsDelivr
 * - $0/month cost
 * 
 * MIGRATION HISTORY:
 * - 2025-01: Migrated from Cloudflare R2 (expensive) to GitHub + jsDelivr (free)
 * - 2025-01: Optimized from 23-shard to 10-shard system for faster deployment
 */

// Simple hash function to distribute words evenly across shards
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Check if a character is a Han character (Chinese/Japanese kanji)
function isHanCharacter(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
         (code >= 0x3400 && code <= 0x4DBF) || // CJK Extension A
         (code >= 0x20000 && code <= 0x2A6DF) || // CJK Extension B
         (code >= 0x2A700 && code <= 0x2B73F) || // CJK Extension C
         (code >= 0x2B740 && code <= 0x2B81F) || // CJK Extension D
         (code >= 0x2B820 && code <= 0x2CEAF); // CJK Extension E
}

// Count Han characters in a string
function countHanCharacters(word: string): number {
  let count = 0;
  for (let i = 0; i < word.length; i++) {
    if (isHanCharacter(word[i])) {
      count++;
    }
  }
  return count;
}

/**
 * Get the shard identifier for a given word using the 10-shard system
 * 
 * SHARDING LOGIC:
 * - 0 Han chars: "non-han" shard (all non-Chinese content)
 * - 1 Han char:  "han-1char-1" or "han-1char-2" (hash-based split)
 * - 2 Han chars: "han-2char-1/2/3" (hash-based 3-way split) 
 * - 3+ Han chars: "han-3plus-1/2/3" (hash-based 3-way split)
 * 
 * @param word - The dictionary word to find the shard for
 * @returns Shard identifier string (e.g., "non-han", "han-1char-1")
 */
export function getShardName(word: string): string {
  const hanCount = countHanCharacters(word);
  const hash = simpleHash(word);
  
  if (hanCount === 0) {
    // All non-Han characters (English, kana, symbols, etc.)
    return 'non-han';
  } else if (hanCount === 1) {
    // Single Han character: split into 2 shards using hash
    return hash % 2 === 0 ? 'han-1char-1' : 'han-1char-2';
  } else if (hanCount === 2) {
    // Two Han characters: split into 3 shards using hash
    const shardNum = (hash % 3) + 1;
    return `han-2char-${shardNum}`;
  } else {
    // Three or more Han characters: split into 3 shards using hash
    const shardNum = (hash % 3) + 1;
    return `han-3plus-${shardNum}`;
  }
}

/**
 * Get the jsDelivr CDN URL for a dictionary word
 * 
 * PRODUCTION URL FORMAT:
 * https://cdn.jsdelivr.net/gh/Kimeiga/kiokun2-dict-{shard}@latest/{word}.json
 * 
 * EXAMPLES:
 * - "hello" → https://cdn.jsdelivr.net/gh/Kimeiga/kiokun2-dict-non-han@latest/hello.json
 * - "人" → https://cdn.jsdelivr.net/gh/Kimeiga/kiokun2-dict-han-1char-1@latest/人.json
 * - "你好" → https://cdn.jsdelivr.net/gh/Kimeiga/kiokun2-dict-han-2char-2@latest/你好.json
 * 
 * @param word - The dictionary word to look up
 * @returns Full jsDelivr CDN URL for the word's JSON file
 */
export function getJsDelivrUrl(word: string): string {
  const shard = getShardName(word);
  // URL encode the word to handle special characters like %
  const encodedWord = encodeURIComponent(word);
  return `https://cdn.jsdelivr.net/gh/Kimeiga/kiokun2-dict-${shard}@latest/${encodedWord}.json`;
}

/**
 * Get the appropriate dictionary URL based on environment
 * 
 * ENVIRONMENT DETECTION:
 * - Production/Staging: Uses jsDelivr CDN (fast, global, free)
 * - Development: Uses jsDelivr CDN (consistent with production)
 * 
 * @param word - The dictionary word to look up
 * @returns Full URL to fetch the word's dictionary data
 */
export function getDictionaryUrl(word: string): string {
  // Always use jsDelivr for consistency and performance
  return getJsDelivrUrl(word);
}

// Legacy compatibility exports (deprecated - use getDictionaryUrl instead)
export const getShardNumber = (word: string): number => {
  const shard = getShardName(word);
  const mapping: Record<string, number> = {
    'non-han': 0,
    'han-1char-1': 1, 'han-1char-2': 2,
    'han-2char-1': 3, 'han-2char-2': 4, 'han-2char-3': 5,
    'han-3plus-1': 6, 'han-3plus-2': 7, 'han-3plus-3': 8,
    'reserved': 9
  };
  return mapping[shard] || 0;
};