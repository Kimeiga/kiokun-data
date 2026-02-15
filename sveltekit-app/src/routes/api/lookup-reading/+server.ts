import { json, error } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";

/**
 * Result from looking up a word by its reading
 */
interface ReadingLookupResult {
	word: string;
	pronunciation: string;
	is_common: boolean;
}

/**
 * GET /api/lookup-reading?q=たべる&limit=5
 * 
 * Find dictionary words by their hiragana/katakana reading.
 * This enables finding kanji forms from hiragana readings.
 * 
 * Example: /api/lookup-reading?q=たべる returns [{ word: "食べる", ... }]
 * 
 * Query parameters:
 * - q: The reading to search for (hiragana/katakana) (required)
 * - limit: Maximum number of results (default: 5, max: 20)
 * 
 * Returns words where the pronunciation exactly matches the query
 */
export async function GET({ url, platform }: RequestEvent) {
	const query = url.searchParams.get("q");
	const limitParam = url.searchParams.get("limit");
	
	if (!query || query.trim().length === 0) {
		throw error(400, "Reading query is required");
	}
	
	const limit = Math.min(parseInt(limitParam || "5", 10), 20);
	
	if (!platform?.env?.DB) {
		throw error(500, "Database not available");
	}
	
	try {
		// Query for exact pronunciation match
		// We search for words where the pronunciation matches the query exactly
		// This finds kanji forms from hiragana readings
		const results = await platform.env.DB
			.prepare(`
				SELECT DISTINCT
					word,
					pronunciation,
					is_common
				FROM dictionary_search
				WHERE language = 'japanese'
				  AND pronunciation = ?
				ORDER BY
					is_common DESC,
					LENGTH(word) ASC
				LIMIT ?
			`)
			.bind(query.trim(), limit)
			.all();
		
		if (!results.success) {
			throw error(500, "Reading lookup query failed");
		}
		
		// Filter to only return words that differ from the query (i.e., kanji forms)
		// If the word equals the pronunciation, it's just hiragana - not useful
		const kanjiResults = (results.results as ReadingLookupResult[]).filter(
			r => r.word !== query.trim()
		);
		
		return json({
			query: query.trim(),
			results: kanjiResults,
			total: kanjiResults.length,
		});
	} catch (err) {
		console.error("Reading lookup error:", err);
		throw error(500, `Reading lookup failed: ${err instanceof Error ? err.message : "Unknown error"}`);
	}
}

