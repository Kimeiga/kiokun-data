import { json, error } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";

/**
 * Search result from the dictionary_search FTS5 table
 */
interface SearchResult {
	word: string;
	language: string;
	definition: string;
	pronunciation: string;
	is_common: boolean;
}

/**
 * Grouped search results by word
 */
interface GroupedResult {
	word: string;
	language: string;
	pronunciation: string;
	definitions: string[];
	is_common: boolean;
}

/**
 * GET /api/search?q=query&limit=20
 * 
 * Search for dictionary entries by English definition using FTS5 full-text search
 * 
 * Query parameters:
 * - q: Search query (required)
 * - limit: Maximum number of results (default: 20, max: 100)
 * 
 * Returns grouped results where each word has all its matching definitions
 */
export async function GET({ url, platform }: RequestEvent) {
	const query = url.searchParams.get("q");
	const limitParam = url.searchParams.get("limit");
	
	if (!query || query.trim().length === 0) {
		throw error(400, "Search query is required");
	}
	
	const limit = Math.min(parseInt(limitParam || "20", 10), 100);
	
	if (!platform?.env?.DB) {
		throw error(500, "Database not available");
	}
	
	try {
		// Use FTS5 MATCH query for full-text search
		// The query is automatically tokenized and stemmed by FTS5
		// We search across the definition column
		const results = await platform.env.DB
			.prepare(`
				SELECT 
					word,
					language,
					definition,
					pronunciation,
					is_common
				FROM dictionary_search
				WHERE dictionary_search MATCH ?
				ORDER BY 
					is_common DESC,  -- Common words first
					rank                -- FTS5 relevance ranking
				LIMIT ?
			`)
			.bind(query, limit * 3) // Get more results for grouping
			.all();
		
		if (!results.success) {
			throw error(500, "Search query failed");
		}
		
		// Group results by word
		const grouped = new Map<string, GroupedResult>();
		
		for (const row of results.results as SearchResult[]) {
			const key = `${row.word}-${row.language}`;
			
			if (!grouped.has(key)) {
				grouped.set(key, {
					word: row.word,
					language: row.language,
					pronunciation: row.pronunciation,
					definitions: [],
					is_common: row.is_common,
				});
			}
			
			const group = grouped.get(key)!;
			// Avoid duplicate definitions
			if (!group.definitions.includes(row.definition)) {
				group.definitions.push(row.definition);
			}
		}
		
		// Convert to array and limit to requested number of words
		const groupedResults = Array.from(grouped.values()).slice(0, limit);
		
		return json({
			query,
			results: groupedResults,
			total: groupedResults.length,
		});
	} catch (err) {
		console.error("Search error:", err);
		throw error(500, `Search failed: ${err instanceof Error ? err.message : "Unknown error"}`);
	}
}

