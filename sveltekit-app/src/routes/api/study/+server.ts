import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { studyCardContexts, studyCardDeckMemberships, studyCards } from "$lib/server/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
	ensureDeckMembership,
	ensureStudyCard,
	saveStudyCardContext,
	STUDY_DECKS,
	type StudyDeck,
} from "$lib/server/study-decks";
import type { SentenceLanguage } from "$lib/sentence-analysis";

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
	const requestedDeck = url.searchParams.get('deck');
	const deck = Object.values(STUDY_DECKS).includes(requestedDeck as StudyDeck)
		? requestedDeck as StudyDeck
		: null;

	try {
		const allCards = await db
			.select()
			.from(studyCards)
			.where(eq(studyCards.userId, locals.user.id));
		const cardIds = allCards.map((card) => card.id);
		const memberships = cardIds.length
			? await db
				.select()
				.from(studyCardDeckMemberships)
				.where(inArray(studyCardDeckMemberships.cardId, cardIds))
			: [];
		const contexts = cardIds.length
			? await db
				.select()
				.from(studyCardContexts)
				.where(inArray(studyCardContexts.cardId, cardIds))
				.orderBy(desc(studyCardContexts.updatedAt))
			: [];
		const latestContextByCard = new Map<string, typeof contexts[number]>();
		for (const context of contexts) {
			if (!latestContextByCard.has(context.cardId)) {
				latestContextByCard.set(context.cardId, context);
			}
		}
		const cardsByDeck = new Map<string, Set<string>>();
		for (const membership of memberships) {
			if (!cardsByDeck.has(membership.deck)) cardsByDeck.set(membership.deck, new Set());
			cardsByDeck.get(membership.deck)!.add(membership.cardId);
		}

		let filteredCards = [...allCards];
		if (dueOnly) {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			filteredCards = filteredCards.filter((card) => card.nextReview <= today);
		}
		if (language) filteredCards = filteredCards.filter((card) => card.language === language);
		if (deck) {
			const deckCardIds = cardsByDeck.get(deck) || new Set<string>();
			filteredCards = filteredCards.filter((card) => deckCardIds.has(card.id));
		}

		return json({
			cards: filteredCards.map((card) => {
				const context = latestContextByCard.get(card.id);
				return {
					...card,
					context: context ? {
						sentence: context.sentence,
						translation: context.translation,
						language: context.language,
					} : null,
				};
			}),
			total: filteredCards.length,
			deckCounts: {
				all: allCards.length,
				[STUDY_DECKS.SEARCHED_WORDS]: cardsByDeck.get(STUDY_DECKS.SEARCHED_WORDS)?.size || 0,
				[STUDY_DECKS.SEARCHED_SENTENCES]: cardsByDeck.get(STUDY_DECKS.SEARCHED_SENTENCES)?.size || 0,
			},
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
	const body = await request.json().catch(() => null);
	const word = typeof body?.word === 'string' ? body.word.trim() : '';
	const language = body?.language as SentenceLanguage;

	if (!word || !language) {
		throw error(400, "word and language are required");
	}

	if (!['zh', 'ja', 'ko'].includes(language)) {
		throw error(400, "language must be 'zh', 'ja', or 'ko'");
	}
	if (word.length > 100) throw error(400, "word must be 100 characters or fewer");

	const requestedDeck = typeof body?.deck === 'string' ? body.deck : STUDY_DECKS.SEARCHED_WORDS;
	if (!Object.values(STUDY_DECKS).includes(requestedDeck as StudyDeck)) {
		throw error(400, "deck must be 'searched-words' or 'searched-sentences'");
	}
	const sentence = typeof body?.context?.sentence === 'string' ? body.context.sentence.trim() : '';
	const translation = typeof body?.context?.translation === 'string'
		? body.context.translation.trim()
		: '';
	if (sentence.length > 2_000) throw error(400, "context sentence must be 2,000 characters or fewer");
	if (translation.length > 4_000) throw error(400, "context translation must be 4,000 characters or fewer");

	try {
		const existing = await db.select().from(studyCards).where(
			and(
				eq(studyCards.userId, locals.user.id),
				eq(studyCards.word, word)
			)
		).limit(1);

		const card = await ensureStudyCard(db, locals.user.id, word, language);
		await ensureDeckMembership(db, card.id, requestedDeck as StudyDeck);
		if (sentence) {
			await saveStudyCardContext(db, card.id, {
				sentence,
				translation,
				language,
			});
		}

		return json({ success: true, card, alreadyExists: existing.length > 0 });
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
