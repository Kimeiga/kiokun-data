import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "$lib/server/db";
import {
	artifactImages,
	artifactSentences,
	artifacts,
	customWords,
	notes,
	studyCards,
	syncTombstones,
} from "$lib/server/db/schema";

function millis(value: unknown): number | null {
	if (value instanceof Date) return value.getTime();
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const numeric = Number(value);
		if (Number.isFinite(numeric)) return numeric;
		const date = new Date(value);
		if (!Number.isNaN(date.getTime())) return date.getTime();
	}
	return null;
}

function serializeRow<T extends Record<string, unknown>>(row: T): T {
	const output: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(row)) {
		output[key] = millis(value) ?? value;
	}
	return output as T;
}

export async function GET({ locals, platform, url }: RequestEvent) {
	if (!locals.user) throw error(401, "Unauthorized");
	if (!platform?.env?.DB) throw error(500, "Database not available");

	const sinceRaw = Number(url.searchParams.get("since") || "0");
	const since = Number.isFinite(sinceRaw) && sinceRaw > 0 ? new Date(sinceRaw) : new Date(0);
	const userId = locals.user.id;
	const db = getDb(platform.env.DB);

	const [noteRows, cardRows, customWordRows, artifactRows, ownedArtifacts, tombstoneRows] = await Promise.all([
		db
			.select()
			.from(notes)
			.where(and(eq(notes.userId, userId), gt(notes.updatedAt, since))),
		db
			.select()
			.from(studyCards)
			.where(and(eq(studyCards.userId, userId), gt(studyCards.updatedAt, since))),
		db
			.select()
			.from(customWords)
			.where(and(eq(customWords.userId, userId), gt(customWords.updatedAt, since))),
		db
			.select()
			.from(artifacts)
			.where(and(eq(artifacts.userId, userId), gt(artifacts.updatedAt, since))),
		db
			.select({ id: artifacts.id })
			.from(artifacts)
			.where(eq(artifacts.userId, userId)),
		db
			.select()
			.from(syncTombstones)
			.where(and(eq(syncTombstones.userId, userId), gt(syncTombstones.deletedAt, since))),
	]);

	const [imageRows, sentenceRows] = await Promise.all([
		Promise.all(
			ownedArtifacts.map((artifact) =>
				db.select().from(artifactImages).where(eq(artifactImages.artifactId, artifact.id)),
			),
		).then((rows) => rows.flat()),
		Promise.all(
			ownedArtifacts.map((artifact) =>
				db.select().from(artifactSentences).where(eq(artifactSentences.artifactId, artifact.id)),
			),
		).then((rows) => rows.flat()),
	]);

	return json({
		serverTime: Date.now(),
		notes: noteRows.map(serializeRow),
		studyCards: cardRows.map(serializeRow),
		customWords: customWordRows.map(serializeRow),
		artifacts: artifactRows.map(serializeRow),
		artifactImages: imageRows.map(serializeRow),
		artifactSentences: sentenceRows.map(serializeRow),
		tombstones: tombstoneRows.map(serializeRow),
	});
}
