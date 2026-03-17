import { json, error } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";

/**
 * GET /api/learning-resources/words?videoId=abc123
 * 
 * Fetch extracted words for a specific video
 * 
 * Query parameters:
 * - videoId: Video post ID (required)
 */
export async function GET({ url, platform }: RequestEvent) {
	const videoId = url.searchParams.get("videoId");
	
	if (!videoId) {
		throw error(400, "videoId parameter is required");
	}
	
	if (!platform?.env?.DB) {
		throw error(500, "Database not available");
	}
	
	try {
		// Fetch extracted words for this video
		const wordsResult = await platform.env.DB
			.prepare(`
				SELECT 
					id,
					word,
					wordSlug,
					reading,
					translation,
					context,
					timestamp,
					sortOrder
				FROM extracted_words
				WHERE videoPostId = ?
				ORDER BY sortOrder ASC
			`)
			.bind(videoId)
			.all();
		
		return json({
			videoId,
			words: wordsResult.results || [],
			total: wordsResult.results?.length || 0,
		});
	} catch (err) {
		console.error("Error fetching words:", err);
		throw error(500, `Failed to fetch words: ${err instanceof Error ? err.message : "Unknown error"}`);
	}
}

