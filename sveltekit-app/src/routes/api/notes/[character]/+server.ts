import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { notes, user } from "$lib/server/db/schema";
import { eq, desc, and, or } from "drizzle-orm";

// GET /api/notes/[character] - Get all notes for a character
export async function GET({ params, locals, platform }: RequestEvent) {
	const { character } = params;

	if (!character) {
		throw error(400, "Character parameter is required");
	}

	const db = getDb(platform!.env.DB);
	const visibleToViewer = locals.user
		? or(
			eq(notes.isPublic, true),
			eq(notes.isAdmin, true),
			eq(notes.userId, locals.user.id),
		)
		: or(eq(notes.isPublic, true), eq(notes.isAdmin, true));

	const characterNotes = await db
		.select({
			id: notes.id,
			userId: notes.userId,
			character: notes.character,
			noteText: notes.noteText,
			isAdmin: notes.isAdmin,
			isPublic: notes.isPublic,
			createdAt: notes.createdAt,
			updatedAt: notes.updatedAt,
			user: {
				id: user.id,
				name: user.name,
				image: user.image,
			},
		})
		.from(notes)
		.leftJoin(user, eq(notes.userId, user.id))
		.where(and(eq(notes.character, character), visibleToViewer))
		.orderBy(desc(notes.isAdmin), desc(notes.createdAt));

	return json(characterNotes);
}

// POST /api/notes/[character] - Create or update note (upsert)
// Each user can only have ONE note per character
export async function POST({ params, locals, request, platform }: RequestEvent) {
	const { character } = params;

	if (!locals.user) {
		throw error(401, "Must be logged in to create notes");
	}

	if (!character) {
		throw error(400, "Character parameter is required");
	}

	const body = await request.json();
	const { noteText } = body;
	const requestedVisibility = typeof body?.isPublic === "boolean" ? body.isPublic : null;

	if (!noteText || typeof noteText !== "string" || noteText.trim().length === 0) {
		throw error(400, "Note text is required");
	}

	const db = getDb(platform!.env.DB);

	// Check if user already has a note for this character
	const existingNotes = await db
		.select()
		.from(notes)
		.where(and(eq(notes.userId, locals.user.id), eq(notes.character, character)))
		.limit(1);

	const now = new Date();

	if (existingNotes.length > 0) {
		// Update existing note
		await db
			.update(notes)
			.set({
				noteText: noteText.trim(),
				...(requestedVisibility === null ? {} : { isPublic: requestedVisibility }),
				updatedAt: now,
			})
			.where(eq(notes.id, existingNotes[0].id));

		return json({ success: true, id: existingNotes[0].id, updated: true });
	} else {
		// Create new note
		const noteId = crypto.randomUUID();

		await db.insert(notes).values({
			id: noteId,
			userId: locals.user.id,
			character,
			noteText: noteText.trim(),
			isAdmin: locals.isAdmin,
			isPublic: requestedVisibility === true,
			createdAt: now,
			updatedAt: now,
		});

		return json({ success: true, id: noteId, updated: false });
	}
}

// PUT /api/notes/[character] - Update a note (must be owner or admin)
export async function PUT({ params, locals, request, platform }: RequestEvent) {
	const { character } = params;

	if (!locals.user) {
		throw error(401, "Must be logged in to update notes");
	}

	const body = await request.json();
	const { noteId, noteText } = body;
	const requestedVisibility = typeof body?.isPublic === "boolean" ? body.isPublic : null;

	if (!noteId || !noteText) {
		throw error(400, "Note ID and text are required");
	}

	const db = getDb(platform!.env.DB);

	// Get the existing note
	const existingNotes = await db
		.select()
		.from(notes)
		.where(eq(notes.id, noteId))
		.limit(1);

	if (existingNotes.length === 0) {
		throw error(404, "Note not found");
	}

	const existingNote = existingNotes[0];

	// Check if user owns the note or is admin
	if (existingNote.userId !== locals.user.id && !locals.isAdmin) {
		throw error(403, "Not authorized to update this note");
	}

	await db
		.update(notes)
		.set({
			noteText: noteText.trim(),
			...(requestedVisibility === null ? {} : { isPublic: requestedVisibility }),
			updatedAt: new Date(),
		})
		.where(eq(notes.id, noteId));

	return json({ success: true });
}

// DELETE /api/notes/[character] - Delete a note (must be owner or admin)
export async function DELETE({ params, locals, request, platform }: RequestEvent) {
	const { character } = params;

	if (!locals.user) {
		throw error(401, "Must be logged in to delete notes");
	}

	const body = await request.json();
	const { noteId } = body;

	if (!noteId) {
		throw error(400, "Note ID is required");
	}

	const db = getDb(platform!.env.DB);

	// Get the existing note
	const existingNotes = await db
		.select()
		.from(notes)
		.where(eq(notes.id, noteId))
		.limit(1);

	if (existingNotes.length === 0) {
		throw error(404, "Note not found");
	}

	const existingNote = existingNotes[0];

	// Check if user owns the note or is admin
	if (existingNote.userId !== locals.user.id && !locals.isAdmin) {
		throw error(403, "Not authorized to delete this note");
	}

	await db.delete(notes).where(eq(notes.id, noteId));

	return json({ success: true });
}
