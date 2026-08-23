import { and, eq } from 'drizzle-orm';
import type { getDb } from '$lib/server/db';
import { studyCardContexts, studyCardDeckMemberships, studyCards } from '$lib/server/db/schema';
import { generateStudyCardId } from '$lib/utils/srs';
import type { SentenceLanguage } from '$lib/sentence-analysis';

export const STUDY_DECKS = {
	SEARCHED_WORDS: 'searched-words',
	SEARCHED_SENTENCES: 'searched-sentences',
} as const;

export type StudyDeck = typeof STUDY_DECKS[keyof typeof STUDY_DECKS];
type Database = ReturnType<typeof getDb>;

export async function ensureStudyCard(
	db: Database,
	userId: string,
	word: string,
	language: SentenceLanguage
) {
	const normalizedWord = word.trim();
	const existing = await db
		.select()
		.from(studyCards)
		.where(and(eq(studyCards.userId, userId), eq(studyCards.word, normalizedWord)))
		.limit(1);
	if (existing[0]) return existing[0];

	const now = new Date();
	const card = {
		id: generateStudyCardId(),
		userId,
		word: normalizedWord,
		language,
		easeFactor: 250,
		interval: 0,
		repetitions: 0,
		nextReview: now,
		lastReviewed: null,
		createdAt: now,
		updatedAt: now,
	};

	await db.insert(studyCards).values(card).onConflictDoNothing();
	const inserted = await db
		.select()
		.from(studyCards)
		.where(and(eq(studyCards.userId, userId), eq(studyCards.word, normalizedWord)))
		.limit(1);
	return inserted[0] || card;
}

export async function ensureDeckMembership(
	db: Database,
	cardId: string,
	deck: StudyDeck
): Promise<void> {
	await db.insert(studyCardDeckMemberships).values({
		id: crypto.randomUUID(),
		cardId,
		deck,
		createdAt: new Date(),
	}).onConflictDoNothing();
}

export async function saveStudyCardContext(
	db: Database,
	cardId: string,
	context: { sentence: string; translation?: string | null; language: SentenceLanguage }
): Promise<void> {
	const sentence = context.sentence.trim();
	if (!sentence) return;
	const now = new Date();
	await db.insert(studyCardContexts).values({
		id: crypto.randomUUID(),
		cardId,
		sentence,
		translation: context.translation?.trim() || null,
		language: context.language,
		createdAt: now,
		updatedAt: now,
	}).onConflictDoUpdate({
		target: [studyCardContexts.cardId, studyCardContexts.sentence],
		set: {
			translation: context.translation?.trim() || null,
			language: context.language,
			updatedAt: now,
		},
	});
}
