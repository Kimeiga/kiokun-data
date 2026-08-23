import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { artifacts, artifactSentences, sentenceWords } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { analyzeSentence } from "$lib/server/sentence-analysis";
import type { D1Database } from "@cloudflare/workers-types";
import type { SentenceLanguage } from "$lib/sentence-analysis";

async function tokenizeAndEnrich(text: string, language: string, db?: D1Database) {
	const supportedLanguage: SentenceLanguage = language === 'zh' || language === 'ko'
		? language
		: 'ja';
	return analyzeSentence(text, supportedLanguage, db);
}

// POST /api/artifacts/[id]/sentences
export async function POST({ params, locals, request, platform }: RequestEvent) {
	const { id } = params;
	if (!locals.user) throw error(401, "Must be logged in");
	if (!id) throw error(400, "Artifact ID is required");

	const db = getDb(platform!.env.DB);

	const existing = await db
		.select({ userId: artifacts.userId, language: artifacts.language })
		.from(artifacts)
		.where(eq(artifacts.id, id))
		.limit(1);

	if (existing.length === 0) throw error(404, "Artifact not found");
	if (existing[0].userId !== locals.user.id) throw error(403, "Not authorized");

	const body = await request.json();
	const { originalText, translation, imageId } = body;

	if (!originalText || typeof originalText !== "string" || !originalText.trim()) {
		throw error(400, "Original text is required");
	}

	const now = new Date();
	const sentenceId = crypto.randomUUID();
	const language = existing[0].language;

	const existingSentences = await db
		.select({ sortOrder: artifactSentences.sortOrder })
		.from(artifactSentences)
		.where(eq(artifactSentences.artifactId, id))
		.orderBy(artifactSentences.sortOrder);

	const maxOrder = existingSentences.length > 0
		? Math.max(...existingSentences.map(s => s.sortOrder))
		: -1;

	await db.insert(artifactSentences).values({
		id: sentenceId,
		artifactId: id,
		imageId: imageId || null,
		originalText: originalText.trim(),
		translation: translation?.trim() || null,
		sortOrder: maxOrder + 1,
		createdAt: now,
	});

	// Tokenize with kuromoji (or fallback) and store enriched words
	const words = await tokenizeAndEnrich(originalText.trim(), language, platform?.env.DB);
	for (const word of words) {
		await db.insert(sentenceWords).values({
			id: crypto.randomUUID(),
			sentenceId,
			wordSlug: word.wordSlug,
			surfaceForm: word.surfaceForm,
			position: word.position,
			dictionaryForm: word.dictionaryForm,
			reading: word.reading,
			gloss: word.gloss,
			conjugation: word.conjugation || null,
			createdAt: now,
		});
	}

	await db.update(artifacts).set({ updatedAt: now }).where(eq(artifacts.id, id));
	return json({ success: true, id: sentenceId });
}

// PUT /api/artifacts/[id]/sentences
export async function PUT({ params, locals, request, platform }: RequestEvent) {
	const { id } = params;
	if (!locals.user) throw error(401, "Must be logged in");
	if (!id) throw error(400, "Artifact ID is required");

	const db = getDb(platform!.env.DB);

	const existing = await db
		.select({ userId: artifacts.userId, language: artifacts.language })
		.from(artifacts)
		.where(eq(artifacts.id, id))
		.limit(1);

	if (existing.length === 0) throw error(404, "Artifact not found");
	if (existing[0].userId !== locals.user.id) throw error(403, "Not authorized");

	const body = await request.json();
	const { sentenceId, originalText, translation } = body;

	if (!sentenceId) throw error(400, "Sentence ID is required");
	if (!originalText || typeof originalText !== "string" || !originalText.trim()) {
		throw error(400, "Original text is required");
	}

	await db.update(artifactSentences)
		.set({ originalText: originalText.trim(), translation: translation?.trim() || null })
		.where(eq(artifactSentences.id, sentenceId));

	await db.delete(sentenceWords).where(eq(sentenceWords.sentenceId, sentenceId));

	const now = new Date();
	const words = await tokenizeAndEnrich(originalText.trim(), existing[0].language, platform?.env.DB);
	for (const word of words) {
		await db.insert(sentenceWords).values({
			id: crypto.randomUUID(),
			sentenceId,
			wordSlug: word.wordSlug,
			surfaceForm: word.surfaceForm,
			position: word.position,
			dictionaryForm: word.dictionaryForm,
			reading: word.reading,
			gloss: word.gloss,
			conjugation: word.conjugation || null,
			createdAt: now,
		});
	}

	await db.update(artifacts).set({ updatedAt: now }).where(eq(artifacts.id, id));
	return json({ success: true });
}

// DELETE /api/artifacts/[id]/sentences
export async function DELETE({ params, locals, request, platform }: RequestEvent) {
	const { id } = params;
	if (!locals.user) throw error(401, "Must be logged in");
	if (!id) throw error(400, "Artifact ID is required");

	const body = await request.json();
	const { sentenceId } = body;
	if (!sentenceId) throw error(400, "Sentence ID is required");

	const db = getDb(platform!.env.DB);

	const existing = await db
		.select({ userId: artifacts.userId })
		.from(artifacts)
		.where(eq(artifacts.id, id))
		.limit(1);

	if (existing.length === 0) throw error(404, "Artifact not found");
	if (existing[0].userId !== locals.user.id) throw error(403, "Not authorized");

	await db.delete(artifactSentences).where(eq(artifactSentences.id, sentenceId));
	return json({ success: true });
}
