import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { customWords } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

// GET /api/custom-words/[id] - Get a single custom word
export async function GET({ params, platform }: RequestEvent) {
	const { id } = params;
	if (!id) throw error(400, "ID is required");

	const db = getDb(platform!.env.DB);

	const results = await db
		.select()
		.from(customWords)
		.where(eq(customWords.id, id))
		.limit(1);

	if (results.length === 0) {
		throw error(404, "Custom word not found");
	}

	return json(results[0]);
}

// PUT /api/custom-words/[id] - Update a custom word
export async function PUT({ params, locals, request, platform }: RequestEvent) {
	const { id } = params;
	if (!locals.user) throw error(401, "Must be logged in");
	if (!id) throw error(400, "ID is required");

	const db = getDb(platform!.env.DB);

	const existing = await db
		.select()
		.from(customWords)
		.where(eq(customWords.id, id))
		.limit(1);

	if (existing.length === 0) throw error(404, "Custom word not found");

	// Only owner or admin can update
	if (existing[0].userId !== locals.user.id && !locals.isAdmin) {
		throw error(403, "Not authorized to update this word");
	}

	const body = await request.json();
	const { word, language, simplified, traditional, pinyin, jyutping, kanji, kana, hangul, hanja, partOfSpeech, definitions, notes } = body;

	const updateData: Record<string, unknown> = { updatedAt: new Date() };

	if (word !== undefined) updateData.word = word.trim();
	if (language !== undefined) updateData.language = language;
	if (simplified !== undefined) updateData.simplified = simplified || null;
	if (traditional !== undefined) updateData.traditional = traditional || null;
	if (pinyin !== undefined) updateData.pinyin = pinyin || null;
	if (jyutping !== undefined) updateData.jyutping = jyutping || null;
	if (kanji !== undefined) updateData.kanji = kanji || null;
	if (kana !== undefined) updateData.kana = kana || null;
	if (hangul !== undefined) updateData.hangul = hangul || null;
	if (hanja !== undefined) updateData.hanja = hanja || null;
	if (partOfSpeech !== undefined) updateData.partOfSpeech = partOfSpeech ? JSON.stringify(partOfSpeech) : null;
	if (definitions !== undefined) updateData.definitions = JSON.stringify(definitions);
	if (notes !== undefined) updateData.notes = notes || null;

	await db.update(customWords).set(updateData).where(eq(customWords.id, id));

	return json({ success: true });
}

// DELETE /api/custom-words/[id] - Delete a custom word
export async function DELETE({ params, locals, platform }: RequestEvent) {
	const { id } = params;
	if (!locals.user) throw error(401, "Must be logged in");
	if (!id) throw error(400, "ID is required");

	const db = getDb(platform!.env.DB);

	const existing = await db
		.select()
		.from(customWords)
		.where(eq(customWords.id, id))
		.limit(1);

	if (existing.length === 0) throw error(404, "Custom word not found");

	// Only owner or admin can delete
	if (existing[0].userId !== locals.user.id && !locals.isAdmin) {
		throw error(403, "Not authorized to delete this word");
	}

	await db.delete(customWords).where(eq(customWords.id, id));

	return json({ success: true });
}
