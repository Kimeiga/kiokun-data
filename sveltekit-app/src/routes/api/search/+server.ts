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
	reading_search: string;
	is_common: boolean;
}

/**
 * Grouped search results by word
 */
interface GroupedResult {
	word: string;
	language: string;
	languages?: string[]; // all languages this word appears in
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
		// We search across definition and reading_search columns
		// reading_search enables romaji search for Japanese (e.g., "zenkoku" → 全国)
		// and pinyin search for Chinese (e.g., "zhongguo" → 中國)
		const results = await platform.env.DB
			.prepare(`
				SELECT
					word,
					language,
					definition,
					pronunciation,
					reading_search,
					is_common,
					-- Calculate custom relevance score
					CASE
						-- Exact match on definition gets highest priority
						WHEN LOWER(definition) = LOWER(?) THEN 1000
						-- Exact match on reading_search (romaji/pinyin) gets very high priority
						WHEN LOWER(reading_search) = LOWER(?) THEN 900
						-- Reading starts with query gets high priority (e.g., "zen" matches "zenkoku")
						WHEN LOWER(reading_search) LIKE LOWER(? || '%') THEN 600
						-- Definition starts with query gets high priority
						WHEN LOWER(definition) LIKE LOWER(? || '%') THEN 500
						-- Contains query as whole word gets medium priority
						WHEN LOWER(definition) LIKE LOWER('% ' || ? || ' %')
						  OR LOWER(definition) LIKE LOWER(? || ' %')
						  OR LOWER(definition) LIKE LOWER('% ' || ?) THEN 100
						-- Otherwise use FTS5 rank
						ELSE 0
					END as custom_rank
				FROM dictionary_search
				WHERE dictionary_search MATCH ?
				ORDER BY
					custom_rank DESC,   -- Custom relevance first
					is_common DESC,     -- Common words next
					rank                -- FTS5 relevance last
				LIMIT ?
			`)
			.bind(query, query, query, query, query, query, query, query, limit * 3) // Get more results for grouping
			.all();
		
		if (!results.success) {
			throw error(500, "Search query failed");
		}
		
		// Group results by word (unified — same word across languages goes to one page)
		const grouped = new Map<string, GroupedResult & { _pronunciations: Map<string, string> }>();

		for (const row of results.results as SearchResult[]) {
			const key = row.word;

			if (!grouped.has(key)) {
				grouped.set(key, {
					word: row.word,
					language: row.language,
					languages: [row.language],
					pronunciation: '',
					definitions: [],
					is_common: row.is_common,
					_pronunciations: new Map(),
				});
			}

			const group = grouped.get(key)!;
			if (!group.definitions.includes(row.definition)) {
				group.definitions.push(row.definition);
			}
			if (row.pronunciation && !group._pronunciations.has(row.language)) {
				group._pronunciations.set(row.language, row.pronunciation);
			}
			if (group.languages && !group.languages.includes(row.language)) {
				group.languages.push(row.language);
			}
		}

		// Build combined pronunciation strings
		for (const group of grouped.values()) {
			const parts: string[] = [];
			const jp = group._pronunciations.get('japanese');
			const zh = group._pronunciations.get('chinese');
			const ko = group._pronunciations.get('korean');
			if (jp) parts.push(jp);
			if (zh) parts.push(zh);
			if (ko) parts.push(ko);
			group.pronunciation = parts.join(' · ');
		}
		
		// Convert to array, strip internal fields, and limit
		for (const group of grouped.values()) {
			delete (group as any)._pronunciations;
		}
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

