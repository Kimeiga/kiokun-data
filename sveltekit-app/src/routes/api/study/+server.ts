import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { studyCards } from "$lib/server/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { generateStudyCardId } from "$lib/utils/srs";

// GET /api/study - Get user's study cards (optionally filtered by due date)
export async function GET({ locals, platform, url }: RequestEvent) {
	if (!locals.user) {
		throw error(401, "Unauthorized");
	}

	if (!platform?.env?.DB) {
		throw error(500, "Database not available");
	}

	const db = getDb(platform.env.DB);
	const dueOnly = url.searchParams.get('due') === 'true';
	const language = url.searchParams.get('language');

	try {
		let query = db.select().from(studyCards).where(eq(studyCards.userId, locals.user.id));

		if (dueOnly) {
			const now = new Date();
			now.setHours(0, 0, 0, 0);
			query = db.select().from(studyCards).where(
				and(
					eq(studyCards.userId, locals.user.id),
					lte(studyCards.nextReview, now)
				)
			);
		}

		const cards = await query;

		// Filter by language if specified
		const filteredCards = language 
			? cards.filter(c => c.language === language)
			: cards;

		return json({
			cards: filteredCards,
			total: filteredCards.length,
		});
	} catch (err) {
		console.error("Error fetching study cards:", err);
		throw error(500, "Failed to fetch study cards");
	}
}

// POST /api/study - Add a new study card
export async function POST({ locals, platform, request }: RequestEvent) {
	if (!locals.user) {
		throw error(401, "Unauthorized");
	}

	if (!platform?.env?.DB) {
		throw error(500, "Database not available");
	}

	const db = getDb(platform.env.DB);
	const body = await request.json();
	const { word, language } = body;

	if (!word || !language) {
		throw error(400, "word and language are required");
	}

	if (!['zh', 'ja', 'ko'].includes(language)) {
		throw error(400, "language must be 'zh', 'ja', or 'ko'");
	}

	try {
		// Check if card already exists
		const existing = await db.select().from(studyCards).where(
			and(
				eq(studyCards.userId, locals.user.id),
				eq(studyCards.word, word)
			)
		).limit(1);

		if (existing.length > 0) {
			return json({ success: true, card: existing[0], alreadyExists: true });
		}

		const now = new Date();
		const id = generateStudyCardId();

		const newCard = {
			id,
			userId: locals.user.id,
			word,
			language,
			easeFactor: 250, // 2.5
			interval: 0,
			repetitions: 0,
			nextReview: now, // Due immediately for new cards
			lastReviewed: null,
			createdAt: now,
			updatedAt: now,
		};

		await db.insert(studyCards).values(newCard);

		return json({ success: true, card: newCard, alreadyExists: false });
	} catch (err) {
		console.error("Error creating study card:", err);
		throw error(500, "Failed to create study card");
	}
}

// PATCH /api/study - Update a study card (reset progress)
export async function PATCH({ locals, platform, request }: RequestEvent) {
	if (!locals.user) {
		throw error(401, "Unauthorized");
	}

	if (!platform?.env?.DB) {
		throw error(500, "Database not available");
	}

	const db = getDb(platform.env.DB);
	const body = await request.json();
	const { word, action } = body;

	if (!word) {
		throw error(400, "word is required");
	}

	try {
		const now = new Date();

		if (action === 'reset') {
			// Reset card progress to initial state
			await db.update(studyCards)
				.set({
					easeFactor: 250,
					interval: 0,
					repetitions: 0,
					nextReview: now,
					lastReviewed: null,
					updatedAt: now,
				})
				.where(
					and(
						eq(studyCards.userId, locals.user.id),
						eq(studyCards.word, word)
					)
				);
		}

		return json({ success: true });
	} catch (err) {
		console.error("Error updating study card:", err);
		throw error(500, "Failed to update study card");
	}
}

// DELETE /api/study - Remove a study card
export async function DELETE({ locals, platform, request }: RequestEvent) {
	if (!locals.user) {
		throw error(401, "Unauthorized");
	}

	if (!platform?.env?.DB) {
		throw error(500, "Database not available");
	}

	const db = getDb(platform.env.DB);
	const body = await request.json();
	const { word } = body;

	if (!word) {
		throw error(400, "word is required");
	}

	try {
		await db.delete(studyCards).where(
			and(
				eq(studyCards.userId, locals.user.id),
				eq(studyCards.word, word)
			)
		);

		return json({ success: true });
	} catch (err) {
		console.error("Error deleting study card:", err);
		throw error(500, "Failed to delete study card");
	}
}

