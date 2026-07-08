/**
 * Shard utilities for the Kiokun dictionary
 *
 * This module handles the 30-shard distribution system that optimally distributes
 * dictionary entries across GitHub repositories for fast jsDelivr CDN delivery.
 *
 * ARCHITECTURE OVERVIEW (30-shard system with subdirectories):
 * ===========================================================
 * The system uses 30 GitHub repositories (kiokun2-dict-*) to store ~435K dictionary files:
 *
 * Non-Han (4 shards, ~11K files each):
 *   non-han-1, non-han-2, non-han-3, non-han-4
 *
 * Han 1-character (8 shards, ~11K files each):
 *   han-1char-1 through han-1char-8
 *
 * Han 2-character (8 shards, ~13K files each):
 *   han-2char-1 through han-2char-8
 *
 * Han 3+ character (8 shards, ~12K files each):
 *   han-3plus-1 through han-3plus-8
 *
 * Reserved (2 shards, empty for future growth):
 *   reserved-1, reserved-2
 *
 * SUBDIRECTORY STRUCTURE:
 * Each shard uses 256 subdirectories (00-ff) based on hash to keep directory listings small:
 *   kiokun2-dict-non-han-1/
 *   ├── 00/
 *   │   ├── word1.json.deflate
 *   │   └── word2.json.deflate
 *   ├── 01/
 *   ...
 *   └── ff/
 *
 * This results in ~40-50 files per subdirectory, well within GitHub's limits.
 *
 * PERFORMANCE BENEFITS:
 * - Each repo has ~10-13K files (vs 45K before)
 * - Each subdirectory has ~40-50 files (vs 45K before)
 * - Commit tree size ~6-8MB (vs 26MB before)
 * - All shards deploy in parallel
 * - Global CDN distribution via jsDelivr
 * - $0/month cost
 *
 * MIGRATION HISTORY:
 * - 2025-01: Migrated from Cloudflare R2 (expensive) to GitHub + jsDelivr (free)
 * - 2025-01: Optimized from 23-shard to 10-shard system for faster deployment
 * - 2025-02: Expanded to 30-shard system with subdirectories to address GitHub limits
 */

// Simple hash function to distribute words evenly across shards
// MUST match the Rust implementation in src/main.rs exactly!
function simpleHash(str: string): number {
  let hash = 0;
  for (const char of str) {
    const codepoint = char.codePointAt(0) ?? 0;
    // Use wrapping multiplication and addition to match Rust's wrapping_mul and wrapping_add
    hash = (hash * 31 + codepoint) >>> 0; // >>> 0 converts to unsigned 32-bit integer
  }
  return hash;
}

// Check if a character is a Han character (Chinese/Japanese kanji)
function isHanCharacter(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
         (code >= 0x3400 && code <= 0x4DBF) || // CJK Extension A
         (code >= 0x20000 && code <= 0x2A6DF) || // CJK Extension B
         (code >= 0x2A700 && code <= 0x2B73F) || // CJK Extension C
         (code >= 0x2B740 && code <= 0x2B81F) || // CJK Extension D
         (code >= 0x2B820 && code <= 0x2CEAF) || // CJK Extension E
         (code >= 0x2CEB0 && code <= 0x2EBEF) || // CJK Extension F
         (code >= 0x2EBF0 && code <= 0x2EE5F) || // CJK Extension I
         (code >= 0x30000 && code <= 0x3134F) || // CJK Extension G
         (code >= 0x31350 && code <= 0x323AF) || // CJK Extension H
         (code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility Ideographs
         (code >= 0x2F800 && code <= 0x2FA1F); // CJK Compatibility Ideographs Supplement
}

// Count Han characters in a string
function countHanCharacters(word: string): number {
  let count = 0;
  for (const char of word) {
    if (isHanCharacter(char)) {
      count++;
    }
  }
  return count;
}

/**
 * Get the shard identifier for a given word using the 30-shard system
 *
 * SHARDING LOGIC:
 * - 0 Han chars: "non-han-1" through "non-han-4" (4-way hash split)
 * - 1 Han char:  "han-1char-1" through "han-1char-8" (8-way hash split)
 * - 2 Han chars: "han-2char-1" through "han-2char-8" (8-way hash split)
 * - 3+ Han chars: "han-3plus-1" through "han-3plus-8" (8-way hash split)
 *
 * @param word - The dictionary word to find the shard for
 * @returns Shard identifier string (e.g., "non-han-1", "han-1char-3")
 */
export function getShardName(word: string): string {
  const hanCount = countHanCharacters(word);
  const hash = simpleHash(word);

  if (hanCount === 0) {
    // All non-Han characters: split into 4 shards
    const shardNum = (hash % 4) + 1;
    return `non-han-${shardNum}`;
  } else if (hanCount === 1) {
    // Single Han character: split into 8 shards
    const shardNum = (hash % 8) + 1;
    return `han-1char-${shardNum}`;
  } else if (hanCount === 2) {
    // Two Han characters: split into 8 shards
    const shardNum = (hash % 8) + 1;
    return `han-2char-${shardNum}`;
  } else {
    // Three or more Han characters: split into 8 shards
    const shardNum = (hash % 8) + 1;
    return `han-3plus-${shardNum}`;
  }
}

/**
 * Get the subdirectory for a word (first 2 hex digits of hash: 00-ff)
 * This creates 256 subdirectories per shard for optimal directory listing performance
 *
 * @param word - The dictionary word
 * @returns Subdirectory string (e.g., "a3", "00", "ff")
 */
export function getSubdir(word: string): string {
  const hash = simpleHash(word);
  // Get the lowest 8 bits and format as 2-digit hex
  return (hash & 0xFF).toString(16).padStart(2, '0');
}



/**
 * Get the raw GitHub URL for a dictionary word (bypasses jsDelivr CDN)
 *
 * RAW GITHUB URL FORMAT:
 * https://raw.githubusercontent.com/Kimeiga/kiokun2-dict-{shard}/main/{subdir}/{word}.json.deflate
 *
 * The subdir is the first 2 hex digits of the hash (00-ff), creating 256 subdirectories
 * per shard for optimal GitHub performance.
 *
 * Use this as a fallback when jsDelivr cache is stale or for testing.
 *
 * @param word - The dictionary word to look up
 * @returns Full raw GitHub URL for the word's compressed JSON file
 */
export function getRawGitHubUrl(word: string): string {
  const shard = getShardName(word);
  const subdir = getSubdir(word);
  // URL encode the word to handle special characters like %
  const encodedWord = encodeURIComponent(word);
  return `https://raw.githubusercontent.com/Kimeiga/kiokun2-dict-${shard}/main/${subdir}/${encodedWord}.json.deflate`;
}

/**
 * Get the jsDelivr URL for a dictionary word.
 *
 * This is useful as a fallback when GitHub raw temporarily rate-limits browser
 * or edge requests. Raw GitHub remains the freshest source; jsDelivr gives us a
 * globally cached backup with permissive CORS.
 */
export function getJsDelivrUrl(word: string): string {
  const shard = getShardName(word);
  const subdir = getSubdir(word);
  const encodedWord = encodeURIComponent(word);
  return `https://cdn.jsdelivr.net/gh/Kimeiga/kiokun2-dict-${shard}@main/${subdir}/${encodedWord}.json.deflate`;
}

// Cache for the CORS server port
let cachedPort: number | null = null;

function isCapacitorRuntime(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'capacitor:';
}

/**
 * Get the CORS server port by reading from the API endpoint
 * Includes retry logic to handle race conditions during startup
 * @param fetchFn - Optional fetch function (use SvelteKit's fetch in load functions)
 * @returns The port number, or 8000 as fallback
 */
async function getCorsPort(fetchFn: typeof fetch = fetch): Promise<number> {
  if (cachedPort !== null) {
    return cachedPort;
  }

  // Retry up to 5 times with 500ms delay to handle startup race condition
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetchFn('/api/cors-port');
      const data = await response.json();
      if (data.port) {
        cachedPort = data.port;
        return data.port;
      }
    } catch (error) {
      // Only log on last attempt
      if (attempt === 4) {
        console.warn('Failed to fetch CORS port after retries, using default 8000:', error);
      }
    }
    // Wait before retrying
    if (attempt < 4) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return 8000;
}

/**
 * Get the local development URL for a dictionary word
 *
 * LOCAL DEVELOPMENT URL FORMAT:
 * http://localhost:{PORT}/{subdir}/{word}.json.deflate
 *
 * The port is dynamically determined by the CORS server (cors_server.py)
 * which writes the port number to output_dictionary/.cors_port
 *
 * The subdir is the first 2 hex digits of the hash (00-ff), matching the
 * production subdirectory structure.
 *
 * This assumes you're running the CORS server in the output_dictionary folder:
 * cd output_dictionary && python3 cors_server.py
 *
 * @param word - The dictionary word to look up
 * @param fetchFn - Optional fetch function (use SvelteKit's fetch in load functions)
 * @returns Full local URL for the word's compressed JSON file
 */
export async function getLocalUrl(word: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const subdir = getSubdir(word);
  const encodedWord = encodeURIComponent(word);
  const port = await getCorsPort(fetchFn);
  return `http://localhost:${port}/${subdir}/${encodedWord}.json.deflate`;
}

/**
 * Get the appropriate dictionary URL based on environment
 *
 * ENVIRONMENT DETECTION:
 * - Development (dev=true): Uses local HTTP server with dynamic port detection
 * - Production/Staging: Uses raw GitHub URLs
 *
 * For local development, run this in the output_dictionary folder:
 * cd output_dictionary && python3 cors_server.py
 *
 * NOTE: Raw GitHub URLs provide consistent global performance and avoid
 * CDN cache inconsistencies between geographic regions.
 *
 * @param word - The dictionary word to look up
 * @param dev - Whether we're in development mode (from $app/environment)
 * @param fetchFn - Optional fetch function (use SvelteKit's fetch in load functions)
 * @returns Full URL to fetch the word's dictionary data
 */
export async function getDictionaryUrl(word: string, dev: boolean = false, fetchFn: typeof fetch = fetch): Promise<string> {
  if (!dev && isCapacitorRuntime()) {
    return `/__kiokun_offline__/dictionary/${encodeURIComponent(word)}.json.deflate`;
  }

  if (!dev) {
    return `/api/dictionary?word=${encodeURIComponent(word)}`;
  }

  if (dev) {
    return await getLocalUrl(word, fetchFn);
  }
  // Use raw GitHub URLs for production
  return getRawGitHubUrl(word);
}

// Legacy compatibility exports (deprecated - use getDictionaryUrl instead)
export const getShardNumber = (word: string): number => {
  const shard = getShardName(word);
  const mapping: Record<string, number> = {
    'non-han-1': 0, 'non-han-2': 1, 'non-han-3': 2, 'non-han-4': 3,
    'han-1char-1': 4, 'han-1char-2': 5, 'han-1char-3': 6, 'han-1char-4': 7,
    'han-1char-5': 8, 'han-1char-6': 9, 'han-1char-7': 10, 'han-1char-8': 11,
    'han-2char-1': 12, 'han-2char-2': 13, 'han-2char-3': 14, 'han-2char-4': 15,
    'han-2char-5': 16, 'han-2char-6': 17, 'han-2char-7': 18, 'han-2char-8': 19,
    'han-3plus-1': 20, 'han-3plus-2': 21, 'han-3plus-3': 22, 'han-3plus-4': 23,
    'han-3plus-5': 24, 'han-3plus-6': 25, 'han-3plus-7': 26, 'han-3plus-8': 27,
    'reserved-1': 28, 'reserved-2': 29
  };
  return mapping[shard] || 0;
};
