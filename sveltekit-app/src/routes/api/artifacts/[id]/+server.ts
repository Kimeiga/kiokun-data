import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { artifacts, artifactImages, artifactSentences, sentenceWords, user } from "$lib/server/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/artifacts/[id] - Get a single artifact with all its data
export async function GET({ params, locals, platform }: RequestEvent) {
	const { id } = params;
	if (!id) throw error(400, "Artifact ID is required");

	const db = getDb(platform!.env.DB);

	const results = await db
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
		.where(eq(artifacts.id, id))
		.limit(1);

	if (results.length === 0) {
		throw error(404, "Artifact not found");
	}

	const artifact = results[0];

	// Check visibility - private artifacts only visible to owner
	if (!artifact.isPublic && (!locals.user || locals.user.id !== artifact.userId)) {
		throw error(404, "Artifact not found");
	}

	// Fetch images
	const images = await db
		.select()
		.from(artifactImages)
		.where(eq(artifactImages.artifactId, id))
		.orderBy(artifactImages.sortOrder);

	// Fetch sentences with their linked words
	const sentences = await db
		.select()
		.from(artifactSentences)
		.where(eq(artifactSentences.artifactId, id))
		.orderBy(artifactSentences.sortOrder);

	const sentenceIds = sentences.map(s => s.id);
	let words: typeof sentenceWords.$inferSelect[] = [];
	if (sentenceIds.length > 0) {
		words = await db
			.select()
			.from(sentenceWords)
			.where(
				// Use OR for each sentence ID
				sentenceIds.length === 1
					? eq(sentenceWords.sentenceId, sentenceIds[0])
					: eq(sentenceWords.sentenceId, sentenceIds[0]) // fallback, handled below
			);

		// For multiple sentences, fetch all words
		if (sentenceIds.length > 1) {
			words = [];
			for (const sid of sentenceIds) {
				const w = await db
					.select()
					.from(sentenceWords)
					.where(eq(sentenceWords.sentenceId, sid));
				words.push(...w);
			}
		}
	}

	// Group words by sentence
	const wordsBySentence = new Map<string, typeof words>();
	for (const w of words) {
		const existing = wordsBySentence.get(w.sentenceId) || [];
		existing.push(w);
		wordsBySentence.set(w.sentenceId, existing);
	}

	return json({
		...artifact,
		images,
		sentences: sentences.map(s => ({
			...s,
			words: (wordsBySentence.get(s.id) || []).sort((a, b) => a.position - b.position),
		})),
	});
}

// PUT /api/artifacts/[id] - Update an artifact
export async function PUT({ params, locals, request, platform }: RequestEvent) {
	const { id } = params;
	if (!locals.user) throw error(401, "Must be logged in");
	if (!id) throw error(400, "Artifact ID is required");

	const db = getDb(platform!.env.DB);

	// Verify ownership
	const existing = await db
		.select({ userId: artifacts.userId })
		.from(artifacts)
		.where(eq(artifacts.id, id))
		.limit(1);

	if (existing.length === 0) throw error(404, "Artifact not found");
	if (existing[0].userId !== locals.user.id) throw error(403, "Not authorized");

	const body = await request.json();
	const { title, description, language, type: artifactType, isPublic } = body;

	const updates: Record<string, any> = { updatedAt: new Date() };
	if (title !== undefined) updates.title = title.trim();
	if (description !== undefined) updates.description = description?.trim() || null;
	if (language !== undefined) updates.language = language;
	if (artifactType !== undefined) updates.type = artifactType;
	if (isPublic !== undefined) updates.isPublic = isPublic;

	await db.update(artifacts).set(updates).where(eq(artifacts.id, id));

	return json({ success: true });
}

// DELETE /api/artifacts/[id] - Delete an artifact (cascades to images, sentences, words)
export async function DELETE({ params, locals, platform }: RequestEvent) {
	const { id } = params;
	if (!locals.user) throw error(401, "Must be logged in");
	if (!id) throw error(400, "Artifact ID is required");

	const db = getDb(platform!.env.DB);

	const existing = await db
		.select({ userId: artifacts.userId })
		.from(artifacts)
		.where(eq(artifacts.id, id))
		.limit(1);

	if (existing.length === 0) throw error(404, "Artifact not found");
	if (existing[0].userId !== locals.user.id) throw error(403, "Not authorized");

	await db.delete(artifacts).where(eq(artifacts.id, id));

	return json({ success: true });
}
