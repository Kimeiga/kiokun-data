import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { artifacts, artifactSentences, sentenceWords, user } from "$lib/server/db/schema";
import { eq, and, or } from "drizzle-orm";

// GET /api/artifacts/by-word/[wordSlug] - Find all artifacts containing a word
export async function GET({ params, locals, platform }: RequestEvent) {
	const { wordSlug } = params;
	if (!wordSlug) throw error(400, "Word slug is required");

	const db = getDb(platform!.env.DB);

	// Find all sentence_words matching this slug
	const wordMentions = await db
		.select({
			sentenceId: sentenceWords.sentenceId,
			surfaceForm: sentenceWords.surfaceForm,
		})
		.from(sentenceWords)
		.where(eq(sentenceWords.wordSlug, wordSlug));

	if (wordMentions.length === 0) {
		return json([]);
	}

	const sentenceIds = [...new Set(wordMentions.map(w => w.sentenceId))];

	// Fetch the sentences
	const sentences = [];
	for (const sid of sentenceIds) {
		const s = await db
			.select()
			.from(artifactSentences)
			.where(eq(artifactSentences.id, sid))
			.limit(1);
		if (s.length > 0) sentences.push(s[0]);
	}

	if (sentences.length === 0) return json([]);

	const artifactIds = [...new Set(sentences.map(s => s.artifactId))];

	// Fetch artifacts with visibility check
	const results = [];
	for (const aid of artifactIds) {
		const conditions = [eq(artifacts.id, aid)];
		// Only show public artifacts or user's own
		if (locals.user) {
			conditions.push(
				or(eq(artifacts.isPublic, true), eq(artifacts.userId, locals.user.id))!
			);
		} else {
			conditions.push(eq(artifacts.isPublic, true));
		}

		const a = await db
			.select({
				id: artifacts.id,
				userId: artifacts.userId,
				title: artifacts.title,
				language: artifacts.language,
				type: artifacts.type,
				user: {
					id: user.id,
					name: user.name,
				},
			})
			.from(artifacts)
			.leftJoin(user, eq(artifacts.userId, user.id))
			.where(and(...conditions))
			.limit(1);

		if (a.length > 0) {
			const relatedSentences = sentences
				.filter(s => s.artifactId === a[0].id)
				.map(s => ({
					id: s.id,
					originalText: s.originalText,
					translation: s.translation,
				}));

			results.push({
				...a[0],
				sentences: relatedSentences,
			});
		}
	}

	return json(results);
}
