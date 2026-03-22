import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { customWords, user } from "$lib/server/db/schema";
import { eq, desc, and, like, or } from "drizzle-orm";

// GET /api/custom-words - List custom words with optional filters
export async function GET({ url, platform }: RequestEvent) {
	const db = getDb(platform!.env.DB);
	const userId = url.searchParams.get("userId");
	const language = url.searchParams.get("language");
	const q = url.searchParams.get("q");
	const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
	const offset = parseInt(url.searchParams.get("offset") || "0");

	try {
		let query = db
			.select({
				id: customWords.id,
				userId: customWords.userId,
				word: customWords.word,
				language: customWords.language,
				simplified: customWords.simplified,
				traditional: customWords.traditional,
				pinyin: customWords.pinyin,
				jyutping: customWords.jyutping,
				kanji: customWords.kanji,
				kana: customWords.kana,
				hangul: customWords.hangul,
				hanja: customWords.hanja,
				partOfSpeech: customWords.partOfSpeech,
				definitions: customWords.definitions,
				notes: customWords.notes,
				createdAt: customWords.createdAt,
				updatedAt: customWords.updatedAt,
				user: {
					id: user.id,
					name: user.name,
					image: user.image,
				},
			})
			.from(customWords)
			.leftJoin(user, eq(customWords.userId, user.id))
			.orderBy(desc(customWords.createdAt))
			.limit(limit)
			.offset(offset);

		const conditions = [];
		if (userId) conditions.push(eq(customWords.userId, userId));
		if (language) conditions.push(eq(customWords.language, language));
		if (q) {
			conditions.push(
				or(
					like(customWords.word, `%${q}%`),
					like(customWords.definitions, `%${q}%`),
					like(customWords.pinyin, `%${q}%`),
					like(customWords.kana, `%${q}%`),
					like(customWords.hangul, `%${q}%`),
				)!
			);
		}

		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as typeof query;
		}

		const results = await query;
		return json(results);
	} catch (err) {
		console.error("Custom words list error:", err);
		throw error(500, "Failed to list custom words");
	}
}

// POST /api/custom-words - Create a new custom word
export async function POST({ locals, request, platform }: RequestEvent) {
	if (!locals.user) {
		throw error(401, "Must be logged in to create custom words");
	}

	const body = await request.json();
	const { word, language, simplified, traditional, pinyin, jyutping, kanji, kana, hangul, hanja, partOfSpeech, definitions, notes } = body;

	if (!word || typeof word !== "string" || !word.trim()) {
		throw error(400, "Word is required");
	}
	if (!language || !["zh", "ja", "ko"].includes(language)) {
		throw error(400, "Language must be zh, ja, or ko");
	}
	if (!definitions || !Array.isArray(definitions) || definitions.length === 0) {
		throw error(400, "At least one definition is required");
	}

	const db = getDb(platform!.env.DB);
	const trimmedWord = word.trim();

	// Check for duplicate custom word
	const existing = await db
		.select({ id: customWords.id })
		.from(customWords)
		.where(eq(customWords.word, trimmedWord))
		.limit(1);

	if (existing.length > 0) {
		throw error(409, `A custom word "${trimmedWord}" already exists`);
	}

	const now = new Date();
	const id = crypto.randomUUID();

	await db.insert(customWords).values({
		id,
		userId: locals.user.id,
		word: trimmedWord,
		language,
		simplified: simplified || null,
		traditional: traditional || null,
		pinyin: pinyin || null,
		jyutping: jyutping || null,
		kanji: kanji || null,
		kana: kana || null,
		hangul: hangul || null,
		hanja: hanja || null,
		partOfSpeech: partOfSpeech ? JSON.stringify(partOfSpeech) : null,
		definitions: JSON.stringify(definitions),
		notes: notes || null,
		createdAt: now,
		updatedAt: now,
	});

	return json({ success: true, id, word: trimmedWord });
}
