import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { studyCards } from "$lib/server/db/schema";
import { eq, and } from "drizzle-orm";
import { generateStudyCardId } from "$lib/utils/srs";

// POST /api/study/import - Bulk import words to study deck
export async function POST({ locals, platform, request }: RequestEvent) {
	if (!locals.user) {
		throw error(401, "Unauthorized");
	}

	if (!platform?.env?.DB) {
		throw error(500, "Database not available");
	}

	const db = getDb(platform.env.DB);
	const body = await request.json();
	const { words, language } = body;

	if (!words || !Array.isArray(words) || words.length === 0) {
		throw error(400, "words array is required");
	}

	if (!language || !['zh', 'ja', 'ko'].includes(language)) {
		throw error(400, "language must be 'zh', 'ja', or 'ko'");
	}

	// Limit to 100 words per import
	if (words.length > 100) {
		throw error(400, "Maximum 100 words per import");
	}

	try {
		const now = new Date();
		let imported = 0;
		let skipped = 0;

		// Get existing cards for this user
		const existingCards = await db.select({ word: studyCards.word })
			.from(studyCards)
			.where(eq(studyCards.userId, locals.user.id));
		
		const existingWords = new Set(existingCards.map(c => c.word));

		// Filter out already-existing words
		const newWords = words.filter((w: string) => !existingWords.has(w));
		skipped = words.length - newWords.length;

		// Insert new cards
		if (newWords.length > 0) {
			const cardsToInsert = newWords.map((word: string) => ({
				id: generateStudyCardId(),
				userId: locals.user!.id,
				word,
				language,
				easeFactor: 250,
				interval: 0,
				repetitions: 0,
				nextReview: now,
				lastReviewed: null,
				createdAt: now,
				updatedAt: now,
			}));

			// Insert in batches to avoid SQLite limits
			const batchSize = 50;
			for (let i = 0; i < cardsToInsert.length; i += batchSize) {
				const batch = cardsToInsert.slice(i, i + batchSize);
				await db.insert(studyCards).values(batch);
			}

			imported = newWords.length;
		}

		return json({
			success: true,
			imported,
			skipped,
			total: words.length,
		});
	} catch (err) {
		console.error("Error importing cards:", err);
		throw error(500, "Failed to import cards");
	}
}

