import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { customWords, user } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

// GET /api/custom-words/by-word/[word] - Look up a custom word by its word string
export async function GET({ params, platform }: RequestEvent) {
	const { word } = params;
	if (!word) throw error(400, "Word is required");

	const db = getDb(platform!.env.DB);

	const results = await db
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
		.where(eq(customWords.word, word))
		.limit(1);

	if (results.length === 0) {
		throw error(404, "Custom word not found");
	}

	return json(results[0]);
}
