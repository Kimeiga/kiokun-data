import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { artifacts, artifactImages, artifactSentences, user } from "$lib/server/db/schema";
import { publishedArtifacts } from "$lib/server/published-artifacts";
import { eq, desc, and, or, like, sql } from "drizzle-orm";

function getPublishedArtifacts({
	language,
	type,
	visibility,
	q,
}: {
	language: string | null;
	type: string | null;
	visibility: string | null;
	q: string | null;
}) {
	if (visibility === "mine") return [];
	const needle = q?.trim().toLocaleLowerCase();
	return publishedArtifacts.filter((artifact) => {
		if (language && artifact.language !== language) return false;
		if (type && artifact.type !== type) return false;
		if (needle) {
			const haystack = `${artifact.title} ${artifact.description || ""}`.toLocaleLowerCase();
			if (!haystack.includes(needle)) return false;
		}
		return true;
	});
}

// GET /api/artifacts - List artifacts with optional filters
export async function GET({ url, locals, platform }: RequestEvent) {
	const db = getDb(platform!.env.DB);
	const userId = url.searchParams.get("userId");
	const language = url.searchParams.get("language");
	const type = url.searchParams.get("type");
	const visibility = url.searchParams.get("visibility"); // 'public', 'mine', 'all'
	const q = url.searchParams.get("q");
	const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
	const offset = parseInt(url.searchParams.get("offset") || "0");

	try {
		const conditions = [];

		// Visibility filtering
		if (visibility === "mine" && locals.user) {
			conditions.push(eq(artifacts.userId, locals.user.id));
		} else if (userId) {
			conditions.push(eq(artifacts.userId, userId));
			// If viewing someone else's artifacts, only show public
			if (!locals.user || locals.user.id !== userId) {
				conditions.push(eq(artifacts.isPublic, true));
			}
		} else {
			// Global view: show public + user's own private artifacts
			if (locals.user) {
				conditions.push(
					or(
						eq(artifacts.isPublic, true),
						eq(artifacts.userId, locals.user.id)
					)!
				);
			} else {
				conditions.push(eq(artifacts.isPublic, true));
			}
		}

		if (language) conditions.push(eq(artifacts.language, language));
		if (type) conditions.push(eq(artifacts.type, type));
		if (q) {
			conditions.push(
				or(
					like(artifacts.title, `%${q}%`),
					like(artifacts.description, `%${q}%`)
				)!
			);
		}

		let query = db
			.select({
				id: artifacts.id,
				userId: artifacts.userId,
				title: artifacts.title,
				description: artifacts.description,
				language: artifacts.language,
				type: artifacts.type,
				isPublic: artifacts.isPublic,
				createdAt: artifacts.createdAt,
				updatedAt: artifacts.updatedAt,
				user: {
					id: user.id,
					name: user.name,
					image: user.image,
				},
			})
			.from(artifacts)
			.leftJoin(user, eq(artifacts.userId, user.id))
			.orderBy(desc(artifacts.createdAt))
			.limit(limit)
			.offset(offset);

		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as typeof query;
		}

		const results = await query;
		const published = userId
			? []
			: getPublishedArtifacts({ language, type, visibility, q });

		// Fetch image counts and first image for each artifact
		const artifactIds = results.map(r => r.id);
		if (artifactIds.length > 0) {
			const images = await db
				.select({
					artifactId: artifactImages.artifactId,
					imageUrl: artifactImages.imageUrl,
					sortOrder: artifactImages.sortOrder,
				})
				.from(artifactImages)
				.where(sql`${artifactImages.artifactId} IN (${sql.join(artifactIds.map(id => sql`${id}`), sql`, `)})`)
				.orderBy(artifactImages.sortOrder);

			const imagesByArtifact = new Map<string, string>();
			for (const img of images) {
				if (!imagesByArtifact.has(img.artifactId)) {
					imagesByArtifact.set(img.artifactId, img.imageUrl);
				}
			}

			const sentenceCounts = await db
				.select({
					artifactId: artifactSentences.artifactId,
					count: sql<number>`count(*)`.as("count"),
				})
				.from(artifactSentences)
				.where(sql`${artifactSentences.artifactId} IN (${sql.join(artifactIds.map(id => sql`${id}`), sql`, `)})`)
				.groupBy(artifactSentences.artifactId);

			const countMap = new Map(sentenceCounts.map(s => [s.artifactId, s.count]));
			const dbArtifacts = results.map(r => ({
				...r,
				thumbnailUrl: imagesByArtifact.get(r.id) || null,
				sentenceCount: countMap.get(r.id) || 0,
			}));

			return json([...published, ...dbArtifacts]
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
				.slice(0, limit));
		}

		return json([...published, ...results.map(r => ({ ...r, thumbnailUrl: null, sentenceCount: 0 }))]
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, limit));
	} catch (err) {
		console.error("Artifacts list error:", err);
		throw error(500, "Failed to list artifacts");
	}
}

// POST /api/artifacts - Create a new artifact
export async function POST({ locals, request, platform }: RequestEvent) {
	if (!locals.user) {
		throw error(401, "Must be logged in to create artifacts");
	}

	const body = await request.json();
	const { title, description, language, type: artifactType, isPublic } = body;

	if (!title || typeof title !== "string" || !title.trim()) {
		throw error(400, "Title is required");
	}
	if (!language || !["zh", "ja", "ko"].includes(language)) {
		throw error(400, "Language must be zh, ja, or ko");
	}

	const validTypes = ["packaging", "sign", "menu", "book", "media", "other"];
	const finalType = validTypes.includes(artifactType) ? artifactType : "other";

	const db = getDb(platform!.env.DB);
	const now = new Date();
	const id = crypto.randomUUID();

	await db.insert(artifacts).values({
		id,
		userId: locals.user.id,
		title: title.trim(),
		description: description?.trim() || null,
		language,
		type: finalType,
		isPublic: isPublic !== false, // default true
		createdAt: now,
		updatedAt: now,
	});

	return json({ success: true, id });
}
