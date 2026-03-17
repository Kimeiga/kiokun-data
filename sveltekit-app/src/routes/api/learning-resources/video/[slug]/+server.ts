import { json, error } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";

/**
 * GET /api/learning-resources/video/[slug]?source=scripting-japan
 * 
 * Fetch a single video by slug with all extracted words
 * 
 * Query parameters:
 * - source: Resource source slug (required)
 */
export async function GET({ params, url, platform }: RequestEvent) {
	const { slug } = params;
	const sourceSlug = url.searchParams.get("source");
	
	if (!sourceSlug) {
		throw error(400, "source parameter is required");
	}
	
	if (!platform?.env?.DB) {
		throw error(500, "Database not available");
	}
	
	try {
		// Get resource source ID
		const sourceResult = await platform.env.DB
			.prepare(`
				SELECT id FROM resource_sources
				WHERE slug = ?
				LIMIT 1
			`)
			.bind(sourceSlug)
			.first();
		
		if (!sourceResult) {
			throw error(404, `Resource source "${sourceSlug}" not found`);
		}
		
		// Fetch video by slug
		const videoResult = await platform.env.DB
			.prepare(`
				SELECT 
					id,
					title,
					slug,
					videoUrl,
					videoId,
					thumbnailUrl,
					duration,
					publishedAt,
					transcript,
					summary,
					viewCount,
					createdAt
				FROM video_posts
				WHERE resourceSourceId = ? AND slug = ?
				LIMIT 1
			`)
			.bind(sourceResult.id, slug)
			.first();
		
		if (!videoResult) {
			throw error(404, `Video "${slug}" not found`);
		}
		
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
			.bind(videoResult.id)
			.all();
		
		return json({
			video: videoResult,
			words: wordsResult.results || [],
		});
	} catch (err) {
		console.error("Error fetching video:", err);
		throw error(500, `Failed to fetch video: ${err instanceof Error ? err.message : "Unknown error"}`);
	}
}

