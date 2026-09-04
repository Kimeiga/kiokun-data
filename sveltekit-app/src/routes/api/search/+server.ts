import { json, error } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getCjkSearchTerms, getSearchTarget } from "$lib/search-aliases";

/**
 * Search result from the dictionary_search FTS5 table
 */
interface SearchResult {
	word: string;
	language: string;
	definition: string;
	pronunciation: string;
	reading_search: string;
	is_common: boolean | number;
}

/**
 * Grouped search results by word
 */
interface GroupedResult {
	word: string;
	targetWord: string;
	forms: string[];
	language: string;
	languages?: string[]; // all languages this word appears in
	pronunciation: string;
	definitions: string[];
	is_common: boolean;
}

function isJapaneseKanaQuery(query: string): boolean {
	return /^[\u3040-\u30ff]+$/u.test(query.trim());
}

function normalizeJapaneseReading(query: string): string {
	return query.trim().replace(/[\u30a1-\u30f6]/gu, (character) =>
		String.fromCharCode(character.charCodeAt(0) - 0x60)
	);
}

function fts5Phrase(value: string): string {
	return `"${value.replace(/"/g, '""')}"`;
}

function buildCjkMatchQuery(searchTerms: string[], japaneseReading: string | null): string {
	const clauses = searchTerms.map((term) => `word : ${fts5Phrase(term)}*`);
	if (japaneseReading) clauses.push(`pronunciation : ${fts5Phrase(japaneseReading)}*`);
	return clauses.join(' OR ');
}

function buildCjkSearchSql(searchTerms: string[], includeJapaneseReading: boolean) {
	const exactRank = searchTerms
		.map((_, index) => `WHEN word = ? THEN ${index === 0 ? 1000 : 900}`)
		.join("\n");
	const prefixRank = searchTerms
		.map((_, index) => `WHEN word LIKE ? || '%' THEN ${index === 0 ? 500 : 450}`)
		.join("\n");
	const readingRank = includeJapaneseReading
		? "WHEN language = 'japanese' AND pronunciation = ? THEN 875"
		: "";

	return `
		SELECT
			word,
			language,
			definition,
			pronunciation,
			reading_search,
			is_common,
			CASE
				${exactRank}
				${readingRank}
				${prefixRank}
				ELSE 0
			END as custom_rank
		FROM dictionary_search
		WHERE dictionary_search MATCH ?
		ORDER BY
			custom_rank DESC,
			is_common DESC,
			LENGTH(word) ASC,
			rowid ASC
		LIMIT ?
	`;
}

function displayScore(row: SearchResult, targetWord: string, query: string, searchTerms: string[]): number {
	if (row.word === query) return 1000;
	if (row.word === targetWord && targetWord === query) return 950;
	if (row.word === targetWord && searchTerms.includes(row.word)) return 900;
	if (searchTerms.includes(row.word)) return 850;
	if (row.word === targetWord) return 700;
	if (row.language === "japanese" && targetWord !== row.word) return 650;
	return 500;
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
		// Detect if query contains CJK characters (Chinese/Japanese/Korean)
		const isCJK = /[\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/.test(query);

		let results;

		if (isCJK) {
			// CJK input: search the typed form plus canonical/script variants.
			// Examples: 地図 ⇄ 地圖, 地图 → 地圖, 学 ⇄ 學.
			const searchTerms = getCjkSearchTerms(query);
			const includeJapaneseReading = isJapaneseKanaQuery(query);
			const cjkLimit = Math.min(
				limit * Math.max(4, Math.min(searchTerms.length, 12)),
				1000
			);
			const normalizedReading = includeJapaneseReading ? normalizeJapaneseReading(query) : null;
			const readingBindings = normalizedReading ? [normalizedReading] : [];
			const matchQuery = buildCjkMatchQuery(searchTerms, normalizedReading);

			results = await platform.env.DB
				.prepare(buildCjkSearchSql(searchTerms, includeJapaneseReading))
				.bind(
					...searchTerms,
					...readingBindings,
					...searchTerms,
					matchQuery,
					cjkLimit
				)
				.all();
		} else {
			// Latin/romaji/pinyin input: use FTS5 full-text search on definitions and readings
			results = await platform.env.DB
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
						rowid ASC           -- Source order — primary sense (sense 1) wins ties
					LIMIT ?
				`)
				.bind(query, query, query, query, query, query, query, query, limit * 3)
				.all();
		}
		
		if (!results.success) {
			throw error(500, "Search query failed");
		}
		
		// Group results by word (unified — same word across languages goes to one page)
		const searchTerms = isCJK ? getCjkSearchTerms(query) : [query];
		const grouped = new Map<string, GroupedResult & {
			_pronunciations: Map<string, string>;
			_displayScore: number;
		}>();

		for (const row of results.results as SearchResult[]) {
			const targetWord = getSearchTarget(row.word, row.language);
			const key = targetWord;
			const rowDisplayScore = displayScore(row, targetWord, query, searchTerms);

			if (!grouped.has(key)) {
				grouped.set(key, {
					word: row.word,
					targetWord,
					forms: [row.word, targetWord].filter((form, index, forms) => form && forms.indexOf(form) === index),
					language: row.language,
					languages: [row.language],
					pronunciation: '',
					definitions: [],
					is_common: Boolean(row.is_common),
					_pronunciations: new Map(),
					_displayScore: rowDisplayScore,
				});
			}

			const group = grouped.get(key)!;
			if (!group.forms.includes(row.word)) {
				group.forms.push(row.word);
			}
			if (rowDisplayScore > group._displayScore) {
				group.word = row.word;
				group.language = row.language;
				group._displayScore = rowDisplayScore;
			}
			if (!group.definitions.includes(row.definition)) {
				group.definitions.push(row.definition);
			}
			if (row.pronunciation && !group._pronunciations.has(row.language)) {
				group._pronunciations.set(row.language, row.pronunciation);
			}
			if (group.languages && !group.languages.includes(row.language)) {
				group.languages.push(row.language);
			}
			group.is_common = Boolean(group.is_common || row.is_common);
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
			delete (group as any)._displayScore;
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
