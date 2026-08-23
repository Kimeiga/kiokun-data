import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
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
import { calculateNextReview, type ReviewRating } from "$lib/utils/srs";

type SyncEntity = "note" | "studyCard" | "studyReview" | "customWord" | "artifact" | "artifactSentence" | "artifactImage";
type SyncOperation = "upsert" | "delete" | "review" | "reset";

interface MobileChange {
	id: string;
	entity: SyncEntity;
	entityId: string;
	operation: SyncOperation;
	payload?: Record<string, unknown>;
	createdAt?: number;
}

function asString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
	if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
	if (typeof value === "string" && value.trim()) return [value.trim()];
	return [];
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item));
}

function asNumber(value: unknown, fallback = 0): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return fallback;
}

function asDate(value: unknown, fallback = new Date()) {
	if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
	if (typeof value === "string") {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return new Date(parsed);
		const date = new Date(value);
		if (!Number.isNaN(date.getTime())) return date;
	}
	return fallback;
}

function base64ToArrayBuffer(value: string) {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes.buffer;
}

function extensionForContentType(contentType: string) {
	if (contentType.includes("png")) return "png";
	if (contentType.includes("gif")) return "gif";
	if (contentType.includes("webp")) return "webp";
	return "jpg";
}

async function rewriteNoteImageMarkers(
	platform: RequestEvent["platform"],
	userId: string,
	noteText: string,
	payload: Record<string, unknown>,
) {
	const noteImages = asRecordArray(payload["noteImages"]);
	if (noteImages.length === 0) return noteText;
	if (!platform?.env?.BUCKET) throw new Error("image bucket not available");

	let rewritten = noteText;
	for (const image of noteImages) {
		const marker = asString(image["marker"]);
		const base64 = asString(image["imageDataBase64"]);
		if (!marker || !base64 || !rewritten.includes(marker)) continue;

		const contentType = asString(image["contentType"]) || "image/jpeg";
		if (!["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"].includes(contentType)) {
			throw new Error("invalid note image content type");
		}

		const arrayBuffer = base64ToArrayBuffer(base64);
		if (arrayBuffer.byteLength > 5 * 1024 * 1024) {
			throw new Error("note image is larger than 5MB");
		}

		const rawId = asString(image["id"]) || crypto.randomUUID();
		const safeId = rawId.replace(/[^A-Za-z0-9_-]/g, "") || crypto.randomUUID();
		const filename = `${userId}/notes/${Date.now()}-${safeId}.${extensionForContentType(contentType)}`;
		await platform.env.BUCKET.put(filename, arrayBuffer, {
			httpMetadata: { contentType },
		});
		rewritten = rewritten.split(marker).join(`/api/images/${filename}`);
	}

	return rewritten;
}

async function recordTombstone(
	db: ReturnType<typeof getDb>,
	userId: string,
	entity: string,
	entityId: string,
	deletedAt: Date,
) {
	const existing = await db
		.select({ id: syncTombstones.id })
		.from(syncTombstones)
		.where(
			and(
				eq(syncTombstones.userId, userId),
				eq(syncTombstones.entity, entity),
				eq(syncTombstones.entityId, entityId),
			),
		)
		.limit(1);

	if (existing.length > 0) {
		await db
			.update(syncTombstones)
			.set({ deletedAt })
			.where(eq(syncTombstones.id, existing[0].id));
		return;
	}

	await db.insert(syncTombstones).values({
		id: crypto.randomUUID(),
		userId,
		entity,
		entityId,
		deletedAt,
	});
}

export async function POST({ locals, request, platform }: RequestEvent) {
	if (!locals.user) throw error(401, "Unauthorized");
	if (!platform?.env?.DB) throw error(500, "Database not available");

	const body = await request.json();
	const changes = Array.isArray(body?.changes) ? (body.changes as MobileChange[]) : [];
	if (changes.length === 0) throw error(400, "changes must be a non-empty array");
	if (changes.length > 250) throw error(413, "Too many changes in one sync batch");

	const db = getDb(platform.env.DB);
	const userId = locals.user.id;
	const applied: { id: string; status: "applied" | "skipped"; reason?: string }[] = [];

	for (const change of changes) {
		const payload = change.payload ?? {};
		const now = new Date();
		const changedAt = asDate(payload["updatedAt"] ?? change.createdAt, now);

		try {
			if (change.entity === "note") {
				if (change.operation === "delete") {
					const id = asString(payload["id"]) || change.entityId;
					await db.delete(notes).where(and(eq(notes.userId, userId), eq(notes.id, id)));
					await recordTombstone(db, userId, "note", id, changedAt);
				} else {
					const character = asString(payload["character"]) || change.entityId;
					let noteText = asString(payload["noteText"]).trim();
					if (!character || !noteText) throw new Error("note requires character and noteText");
					noteText = await rewriteNoteImageMarkers(platform, userId, noteText, payload);
					const existing = await db
						.select({ id: notes.id, createdAt: notes.createdAt })
						.from(notes)
						.where(and(eq(notes.userId, userId), eq(notes.character, character)))
						.limit(1);
					if (existing.length > 0) {
						await db.update(notes).set({
							noteText,
							isPublic: payload["isPublic"] === true,
							updatedAt: changedAt,
						}).where(eq(notes.id, existing[0].id));
					} else {
						await db.insert(notes).values({
							id: asString(payload["id"]) || crypto.randomUUID(),
							userId,
							character,
							noteText,
							isAdmin: locals.isAdmin,
							isPublic: payload["isPublic"] === true,
							createdAt: asDate(payload["createdAt"], changedAt),
							updatedAt: changedAt,
						});
					}
				}
			} else if (change.entity === "studyCard" || change.entity === "studyReview") {
				const word = asString(payload["word"]) || change.entityId;
				if (!word) throw new Error("study card requires word");

				if (change.operation === "delete") {
					const id = asString(payload["id"]);
					if (id) {
						await db.delete(studyCards).where(and(eq(studyCards.userId, userId), eq(studyCards.id, id)));
						await recordTombstone(db, userId, "studyCard", id, changedAt);
					} else {
						await db.delete(studyCards).where(and(eq(studyCards.userId, userId), eq(studyCards.word, word)));
						await recordTombstone(db, userId, "studyCard", word, changedAt);
					}
				} else if (change.operation === "review") {
					const rating = asString(payload["rating"]) as ReviewRating;
					if (!["again", "hard", "good", "easy"].includes(rating)) throw new Error("invalid review rating");
					const existing = await db
						.select()
						.from(studyCards)
						.where(and(eq(studyCards.userId, userId), eq(studyCards.word, word)))
						.limit(1);
					if (existing.length === 0) throw new Error("study card not found for review");
					const card = existing[0];
					const next = calculateNextReview(
						{
							easeFactor: card.easeFactor,
							interval: card.interval,
							repetitions: card.repetitions,
						},
						rating,
					);
					await db.update(studyCards).set({
						easeFactor: next.easeFactor,
						interval: next.interval,
						repetitions: next.repetitions,
						nextReview: next.nextReview,
						lastReviewed: changedAt,
						updatedAt: changedAt,
					}).where(eq(studyCards.id, card.id));
				} else {
					const existing = await db
						.select({ id: studyCards.id, createdAt: studyCards.createdAt })
						.from(studyCards)
						.where(and(eq(studyCards.userId, userId), eq(studyCards.word, word)))
						.limit(1);
					if (existing.length > 0) {
						const updates = change.operation === "reset"
							? { easeFactor: 250, interval: 0, repetitions: 0, nextReview: changedAt, lastReviewed: null, updatedAt: changedAt }
							: { language: asString(payload["language"]) || "ja", updatedAt: changedAt };
						await db.update(studyCards).set(updates).where(eq(studyCards.id, existing[0].id));
					} else {
						await db.insert(studyCards).values({
							id: asString(payload["id"]) || crypto.randomUUID(),
							userId,
							word,
							language: asString(payload["language"]) || "ja",
							easeFactor: 250,
							interval: 0,
							repetitions: 0,
							nextReview: changedAt,
							lastReviewed: null,
							createdAt: asDate(payload["createdAt"], changedAt),
							updatedAt: changedAt,
						});
					}
				}
			} else if (change.entity === "customWord") {
				const word = asString(payload["word"]) || change.entityId;
				if (change.operation === "delete") {
					const id = asString(payload["id"]);
					if (id) await db.delete(customWords).where(and(eq(customWords.userId, userId), eq(customWords.id, id)));
					else await db.delete(customWords).where(and(eq(customWords.userId, userId), eq(customWords.word, word)));
					await recordTombstone(db, userId, "customWord", id || word, changedAt);
				} else {
					const definitions = asStringArray(payload["definitions"]);
					if (!word || definitions.length === 0) throw new Error("custom word requires word and definitions");
					const values = {
						userId,
						word,
						language: asString(payload["language"]) || "ja",
						definitions: JSON.stringify(definitions),
						notes: asString(payload["notes"]) || null,
						kana: asString(payload["reading"]) || null,
						hangul: asString(payload["reading"]) || null,
						pinyin: asString(payload["reading"]) || null,
						updatedAt: changedAt,
					};
					const existing = await db
						.select({ id: customWords.id })
						.from(customWords)
						.where(and(eq(customWords.userId, userId), eq(customWords.word, word)))
						.limit(1);
					if (existing.length > 0) {
						await db.update(customWords).set(values).where(eq(customWords.id, existing[0].id));
					} else {
						await db.insert(customWords).values({
							id: asString(payload["id"]) || crypto.randomUUID(),
							...values,
							createdAt: asDate(payload["createdAt"], changedAt),
						});
					}
				}
			} else if (change.entity === "artifact") {
				const id = asString(payload["id"]) || change.entityId;
				if (!id) throw new Error("artifact requires id");
				if (change.operation === "delete") {
					await db.delete(artifacts).where(and(eq(artifacts.userId, userId), eq(artifacts.id, id)));
					await recordTombstone(db, userId, "artifact", id, changedAt);
				} else {
					const values = {
						userId,
						title: asString(payload["title"]).trim() || "Untitled",
						description: asString(payload["description"]) || null,
						language: asString(payload["language"]) || "ja",
						type: asString(payload["type"]) || "other",
						isPublic: payload["isPublic"] !== false,
						updatedAt: changedAt,
					};
					const existing = await db
						.select({ id: artifacts.id })
						.from(artifacts)
						.where(and(eq(artifacts.userId, userId), eq(artifacts.id, id)))
						.limit(1);
					if (existing.length > 0) {
						await db.update(artifacts).set(values).where(eq(artifacts.id, id));
					} else {
						await db.insert(artifacts).values({
							id,
							...values,
							createdAt: asDate(payload["createdAt"], changedAt),
						});
					}
				}
			} else if (change.entity === "artifactSentence") {
				const id = asString(payload["id"]) || change.entityId;
				const artifactId = asString(payload["artifactId"]);
				if (!id || !artifactId) throw new Error("artifact sentence requires id and artifactId");

				const ownedArtifact = await db
					.select({ id: artifacts.id })
					.from(artifacts)
					.where(and(eq(artifacts.userId, userId), eq(artifacts.id, artifactId)))
					.limit(1);
				if (ownedArtifact.length === 0) throw new Error("artifact not found for sentence");

				if (change.operation === "delete") {
					await db.delete(artifactSentences).where(eq(artifactSentences.id, id));
					await recordTombstone(db, userId, "artifactSentence", id, changedAt);
				} else {
					const originalText = asString(payload["originalText"]).trim();
					if (!originalText) throw new Error("artifact sentence requires originalText");
					const values = {
						artifactId,
						imageId: asString(payload["imageId"]) || null,
						originalText,
						translation: asString(payload["translation"]).trim() || null,
						sortOrder: asNumber(payload["sortOrder"]),
					};
					const existing = await db
						.select({ id: artifactSentences.id })
						.from(artifactSentences)
						.where(eq(artifactSentences.id, id))
						.limit(1);
					if (existing.length > 0) {
						await db.update(artifactSentences).set(values).where(eq(artifactSentences.id, id));
					} else {
						await db.insert(artifactSentences).values({
							id,
							...values,
							createdAt: asDate(payload["createdAt"], changedAt),
						});
					}
					await db.update(artifacts).set({ updatedAt: changedAt }).where(eq(artifacts.id, artifactId));
				}
			} else if (change.entity === "artifactImage") {
				const id = asString(payload["id"]) || change.entityId;
				const artifactId = asString(payload["artifactId"]);
				if (!id || !artifactId) throw new Error("artifact image requires id and artifactId");

				const ownedArtifact = await db
					.select({ id: artifacts.id })
					.from(artifacts)
					.where(and(eq(artifacts.userId, userId), eq(artifacts.id, artifactId)))
					.limit(1);
				if (ownedArtifact.length === 0) throw new Error("artifact not found for image");

				if (change.operation === "delete") {
					const existingImage = await db
						.select({ imageUrl: artifactImages.imageUrl })
						.from(artifactImages)
						.where(eq(artifactImages.id, id))
						.limit(1);
					if (existingImage.length > 0) {
						const r2Key = existingImage[0].imageUrl.replace("/api/images/", "");
						try {
							await platform.env.BUCKET.delete(r2Key);
						} catch {
							// Non-fatal; D1 remains the source of truth for metadata sync.
						}
					}
					await db.delete(artifactImages).where(eq(artifactImages.id, id));
					await recordTombstone(db, userId, "artifactImage", id, changedAt);
				} else {
					let imageUrl = asString(payload["imageUrl"]);
					const base64 = asString(payload["imageDataBase64"]);
					if (!imageUrl && base64) {
						const contentType = asString(payload["contentType"]) || "image/jpeg";
						const arrayBuffer = base64ToArrayBuffer(base64);
						if (arrayBuffer.byteLength > 5 * 1024 * 1024) {
							throw new Error("artifact image is larger than 5MB");
						}
						const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
						const filename = `${userId}/${Date.now()}-${id}.${extension}`;
						await platform.env.BUCKET.put(filename, arrayBuffer, {
							httpMetadata: { contentType },
						});
						imageUrl = `/api/images/${filename}`;
					}
					if (!imageUrl) throw new Error("artifact image requires imageUrl or imageDataBase64");

					const values = {
						artifactId,
						imageUrl,
						sortOrder: asNumber(payload["sortOrder"]),
					};
					const existing = await db
						.select({ id: artifactImages.id })
						.from(artifactImages)
						.where(eq(artifactImages.id, id))
						.limit(1);
					if (existing.length > 0) {
						await db.update(artifactImages).set(values).where(eq(artifactImages.id, id));
					} else {
						await db.insert(artifactImages).values({
							id,
							...values,
							createdAt: asDate(payload["createdAt"], changedAt),
						});
					}
					await db.update(artifacts).set({ updatedAt: changedAt }).where(eq(artifacts.id, artifactId));
				}
			} else {
				throw new Error(`unsupported entity ${change.entity}`);
			}

			applied.push({ id: change.id, status: "applied" });
		} catch (err) {
			applied.push({
				id: change.id,
				status: "skipped",
				reason: err instanceof Error ? err.message : "unknown error",
			});
		}
	}

	return json({ success: true, applied, serverTime: Date.now() });
}
