import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { studyCards } from "$lib/server/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateNextReview, type ReviewRating } from "$lib/utils/srs";

// POST /api/study/review - Record a review and update SRS fields
export async function POST({ locals, platform, request }: RequestEvent) {
	if (!locals.user) {
		throw error(401, "Unauthorized");
	}

	if (!platform?.env?.DB) {
		throw error(500, "Database not available");
	}

	const db = getDb(platform.env.DB);
	const body = await request.json();
	const { word, rating } = body;

	if (!word || !rating) {
		throw error(400, "word and rating are required");
	}

	const validRatings: ReviewRating[] = ['again', 'hard', 'good', 'easy'];
	if (!validRatings.includes(rating)) {
		throw error(400, "rating must be 'again', 'hard', 'good', or 'easy'");
	}

	try {
		// Get the current card
		const cards = await db.select().from(studyCards).where(
			and(
				eq(studyCards.userId, locals.user.id),
				eq(studyCards.word, word)
			)
		).limit(1);

		if (cards.length === 0) {
			throw error(404, "Study card not found");
		}

		const card = cards[0];
		const now = new Date();

		// Calculate next review using SM-2 algorithm
		const result = calculateNextReview(
			{
				easeFactor: card.easeFactor,
				interval: card.interval,
				repetitions: card.repetitions,
			},
			rating as ReviewRating
		);

		// Update the card
		await db.update(studyCards)
			.set({
				easeFactor: result.easeFactor,
				interval: result.interval,
				repetitions: result.repetitions,
				nextReview: result.nextReview,
				lastReviewed: now,
				updatedAt: now,
			})
			.where(eq(studyCards.id, card.id));

		return json({
			success: true,
			card: {
				...card,
				easeFactor: result.easeFactor,
				interval: result.interval,
				repetitions: result.repetitions,
				nextReview: result.nextReview,
				lastReviewed: now,
			},
		});
	} catch (err) {
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		console.error("Error recording review:", err);
		throw error(500, "Failed to record review");
	}
}

