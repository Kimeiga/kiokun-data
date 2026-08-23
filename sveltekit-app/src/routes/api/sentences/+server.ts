import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import {
	savedSentences,
	savedSentenceWords,
	studyCardDeckMemberships,
} from '$lib/server/db/schema';
import {
	ensureDeckMembership,
	ensureStudyCard,
	saveStudyCardContext,
	STUDY_DECKS,
} from '$lib/server/study-decks';
import { isStudyableSentenceWord, type SentenceLanguage, type SentenceWordAnalysis } from '$lib/sentence-analysis';

const LANGUAGES = new Set<SentenceLanguage>(['ja', 'zh', 'ko']);

function normalizeWords(value: unknown): SentenceWordAnalysis[] {
	if (!Array.isArray(value)) return [];

	return value.flatMap((candidate, index): SentenceWordAnalysis[] => {
		if (!candidate || typeof candidate !== 'object') return [];
		const word = candidate as Record<string, unknown>;
		const surfaceForm = typeof word.surfaceForm === 'string' ? word.surfaceForm.trim() : '';
		const wordSlug = typeof word.wordSlug === 'string' ? word.wordSlug.trim() : surfaceForm;
		if (!surfaceForm || surfaceForm.length > 100 || !wordSlug || wordSlug.length > 100) return [];

		return [{
			surfaceForm,
			wordSlug,
			position: Number.isInteger(word.position) && Number(word.position) >= 0
				? Number(word.position)
				: index,
			dictionaryForm: typeof word.dictionaryForm === 'string'
				? word.dictionaryForm.trim().slice(0, 100) || null
				: null,
			reading: typeof word.reading === 'string' ? word.reading.trim().slice(0, 200) || null : null,
			gloss: typeof word.gloss === 'string' ? word.gloss.trim().slice(0, 500) || null : null,
			conjugation: typeof word.conjugation === 'string'
				? word.conjugation.trim().slice(0, 100) || null
				: null,
		}];
	});
}

async function removeUnusedSentenceDeckMemberships(
	db: ReturnType<typeof getDb>,
	cardIds: Iterable<string>
): Promise<void> {
	for (const cardId of new Set(cardIds)) {
		const remaining = await db
			.select({ id: savedSentenceWords.id })
			.from(savedSentenceWords)
			.where(eq(savedSentenceWords.cardId, cardId))
			.limit(1);
		if (!remaining[0]) {
			await db.delete(studyCardDeckMemberships).where(and(
				eq(studyCardDeckMemberships.cardId, cardId),
				eq(studyCardDeckMemberships.deck, STUDY_DECKS.SEARCHED_SENTENCES),
			));
		}
	}
}

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!platform?.env?.DB) throw error(500, 'Database not available');

	const db = getDb(platform.env.DB);
	const sentences = await db
		.select()
		.from(savedSentences)
		.where(eq(savedSentences.userId, locals.user.id))
		.orderBy(desc(savedSentences.updatedAt));
	const ids = sentences.map((sentence) => sentence.id);
	const wordRows = ids.length
		? await db.select().from(savedSentenceWords).where(inArray(savedSentenceWords.sentenceId, ids))
		: [];
	const wordCounts = new Map<string, number>();
	for (const word of wordRows) {
		wordCounts.set(word.sentenceId, (wordCounts.get(word.sentenceId) || 0) + 1);
	}

	return json({
		sentences: sentences.map((sentence) => ({
			...sentence,
			wordCount: wordCounts.get(sentence.id) || 0,
		})),
	});
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!platform?.env?.DB) throw error(500, 'Database not available');

	const body = await request.json().catch(() => null);
	const text = typeof body?.text === 'string' ? body.text.trim() : '';
	const language = body?.language as SentenceLanguage;
	const mode = body?.mode === 'auto' ? 'auto' : 'manual';
	if (Array.isArray(body?.words) && body.words.length > 150) {
		throw error(400, 'Too many sentence words');
	}
	const words = normalizeWords(body?.words);

	if (!text) throw error(400, 'text is required');
	if (text.length > 2_000) throw error(400, 'text must be 2,000 characters or fewer');
	if (!LANGUAGES.has(language)) throw error(400, 'language must be ja, zh, or ko');

	const db = getDb(platform.env.DB);
	const now = new Date();
	const existing = await db
		.select()
		.from(savedSentences)
		.where(and(
			eq(savedSentences.userId, locals.user.id),
			eq(savedSentences.language, language),
			eq(savedSentences.text, text),
		))
		.limit(1);
	const sentenceId = existing[0]?.id || crypto.randomUUID();
	const saveMode = existing[0]?.saveMode === 'manual' ? 'manual' : mode;
	const priorWords = existing[0] && words.length
		? await db
			.select({ cardId: savedSentenceWords.cardId })
			.from(savedSentenceWords)
			.where(eq(savedSentenceWords.sentenceId, sentenceId))
		: [];
	const values = {
		id: sentenceId,
		userId: locals.user.id,
		text,
		language,
		translation: typeof body?.translation === 'string' ? body.translation.trim() || null : null,
		pinyin: typeof body?.pinyin === 'string' ? body.pinyin.trim() || null : null,
		saveMode,
		createdAt: existing[0]?.createdAt || now,
		updatedAt: now,
	};

	if (existing[0]) {
		await db.update(savedSentences).set({
			translation: values.translation,
			pinyin: values.pinyin,
			saveMode,
			updatedAt: now,
		}).where(eq(savedSentences.id, sentenceId));
		if (words.length) {
			await db.delete(savedSentenceWords).where(eq(savedSentenceWords.sentenceId, sentenceId));
		}
	} else {
		await db.insert(savedSentences).values(values);
	}

	for (const [index, word] of words.filter(isStudyableSentenceWord).entries()) {
		const target = (word.dictionaryForm || word.wordSlug || word.surfaceForm || '').trim();
		if (!target || target.length > 100) continue;
		const card = await ensureStudyCard(db, locals.user.id, target, language);
		await ensureDeckMembership(db, card.id, STUDY_DECKS.SEARCHED_SENTENCES);
		await saveStudyCardContext(db, card.id, {
			sentence: text,
			translation: values.translation,
			language,
		});
		await db.insert(savedSentenceWords).values({
			id: crypto.randomUUID(),
			sentenceId,
			cardId: card.id,
			surfaceForm: word.surfaceForm,
			position: Number.isInteger(word.position) ? word.position : index,
			createdAt: now,
		}).onConflictDoNothing();
	}
	await removeUnusedSentenceDeckMemberships(db, priorWords.map((word) => word.cardId));

	return json({ success: true, id: sentenceId, saveMode });
};

export const DELETE: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!platform?.env?.DB) throw error(500, 'Database not available');

	const body = await request.json().catch(() => null);
	const id = typeof body?.id === 'string' ? body.id : '';
	if (!id) throw error(400, 'id is required');

	const db = getDb(platform.env.DB);
	const owned = await db
		.select({ id: savedSentences.id })
		.from(savedSentences)
		.where(and(eq(savedSentences.id, id), eq(savedSentences.userId, locals.user.id)))
		.limit(1);
	if (!owned[0]) throw error(404, 'Saved sentence not found');

	const affected = await db
		.select({ cardId: savedSentenceWords.cardId })
		.from(savedSentenceWords)
		.where(eq(savedSentenceWords.sentenceId, id));
	await db.delete(savedSentences).where(eq(savedSentences.id, id));

	await removeUnusedSentenceDeckMemberships(db, affected.map((row) => row.cardId));

	return json({ success: true });
};
