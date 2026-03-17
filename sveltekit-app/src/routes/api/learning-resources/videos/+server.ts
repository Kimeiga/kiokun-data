import { json, error } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";

/**
 * GET /api/learning-resources/videos?source=scripting-japan&limit=20
 * 
 * Fetch videos from a specific resource source
 * 
 * Query parameters:
 * - source: Resource source slug (required, e.g., "scripting-japan")
 * - limit: Maximum number of videos (default: 20, max: 50)
 * - offset: Pagination offset (default: 0)
 */
export async function GET({ url, platform }: RequestEvent) {
	const sourceSlug = url.searchParams.get("source");
	const limitParam = url.searchParams.get("limit");
	const offsetParam = url.searchParams.get("offset");
	
	if (!sourceSlug) {
		throw error(400, "Source parameter is required");
	}
	
	const limit = Math.min(parseInt(limitParam || "20", 10), 50);
	const offset = parseInt(offsetParam || "0", 10);
	
	if (!platform?.env?.DB) {
		throw error(500, "Database not available");
	}
	
	try {
		// First, get the resource source ID
		const sourceResult = await platform.env.DB
			.prepare(`
				SELECT id, name, description, thumbnailUrl
				FROM resource_sources
				WHERE slug = ?
				LIMIT 1
			`)
			.bind(sourceSlug)
			.first();
		
		if (!sourceResult) {
			throw error(404, `Resource source "${sourceSlug}" not found`);
		}
		
		// Fetch videos for this source
		const videosResult = await platform.env.DB
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
					summary,
					viewCount,
					createdAt
				FROM video_posts
				WHERE resourceSourceId = ?
				ORDER BY publishedAt DESC
				LIMIT ? OFFSET ?
			`)
			.bind(sourceResult.id, limit, offset)
			.all();
		
		// Get total count
		const countResult = await platform.env.DB
			.prepare(`
				SELECT COUNT(*) as total
				FROM video_posts
				WHERE resourceSourceId = ?
			`)
			.bind(sourceResult.id)
			.first();
		
		return json({
			source: {
				id: sourceResult.id,
				name: sourceResult.name,
				description: sourceResult.description,
				thumbnailUrl: sourceResult.thumbnailUrl,
			},
			videos: videosResult.results || [],
			total: countResult?.total || 0,
			limit,
			offset,
		});
	} catch (err) {
		console.error("Error fetching videos:", err);
		throw error(500, `Failed to fetch videos: ${err instanceof Error ? err.message : "Unknown error"}`);
	}
}

