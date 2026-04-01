import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { artifacts, artifactSentences, sentenceWords } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { buildWordTokens } from "$lib/utils/segment";
import { lookupWord } from "$lib/server/dictionary-lookup";
import { getTokenizer, tokenizeJapanese } from "$lib/server/kuromoji-loader";

/**
 * Check if a token is content (not punctuation/whitespace).
 */
function isContentToken(pos: string): boolean {
	// Skip particles (助詞), auxiliary verbs (助動詞), symbols, punctuation
	// Actually, keep everything meaningful — particles are useful for learners
	return pos !== '記号'; // Only skip punctuation symbols
}

/**
 * Check if a surface form is all kana (hiragana or katakana)
 */
function isAllKana(text: string): boolean {
	return /^[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FFー]+$/.test(text);
}

/**
 * Tokenize and enrich a sentence. Uses kuromoji for Japanese if available,
 * falls back to tiny-segmenter + dictionary lookups.
 */
async function tokenizeAndEnrich(text: string, language: string, bucket?: R2Bucket) {
	// For Japanese with R2 available, use kuromoji (best quality)
	if (language === 'ja' && bucket) {
		try {
			const tokenizer = await getTokenizer(bucket);
			const tokens = tokenizeJapanese(tokenizer, text);

			// For each token, look up gloss from our dictionary
			const enriched = await Promise.all(
				tokens.map(async (t) => {
					// Use kuromoji's dictionary form for the lookup
					const lookupKey = t.basicForm || t.surfaceForm;
					const dictData = await lookupWord(lookupKey, language);

					// Reading: use kuromoji's reading, but skip if it's the same as surface (all kana)
					let reading = t.reading;
					if (reading && isAllKana(t.surfaceForm)) reading = null;

					return {
						surfaceForm: t.surfaceForm,
						wordSlug: t.surfaceForm,
						position: t.position,
						dictionaryForm: t.basicForm !== t.surfaceForm ? t.basicForm : null,
						reading: reading || dictData.reading,
						gloss: dictData.gloss,
					};
				})
			);

			return enriched.filter(t => t.surfaceForm.trim().length > 0 && t.surfaceForm !== '。' && t.surfaceForm !== '、');
		} catch (err) {
			console.error('Kuromoji tokenization failed, falling back:', err);
		}
	}

	// Fallback: tiny-segmenter + dictionary lookup heuristics
	const tokens = buildWordTokens(text, language);
	const enriched = await Promise.all(
		tokens.map(async (token) => {
			const lookup = await lookupWord(token.surfaceForm, language);
			return {
				...token,
				dictionaryForm: lookup.dictionaryForm,
				reading: lookup.reading,
				gloss: lookup.gloss,
			};
		})
	);
	return enriched;
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
	const words = await tokenizeAndEnrich(originalText.trim(), language, platform?.env.BUCKET);
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
	const words = await tokenizeAndEnrich(originalText.trim(), existing[0].language, platform?.env.BUCKET);
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
