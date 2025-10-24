import { json, error } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { notes } from "$lib/server/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/user/notes - Get all notes for the current user
export async function GET({ locals, platform }: RequestEvent) {
	// Check if user is authenticated
	if (!locals.user) {
		throw error(401, "Unauthorized");
	}

	const db = getDb(platform!.env.DB);

	// Get all notes for this user
	const userNotes = await db
		.select({
			id: notes.id,
			userId: notes.userId,
			character: notes.character,
			noteText: notes.noteText,
			isAdmin: notes.isAdmin,
			createdAt: notes.createdAt,
			updatedAt: notes.updatedAt,
		})
		.from(notes)
		.where(eq(notes.userId, locals.user.id))
		.orderBy(desc(notes.updatedAt));

	return json(userNotes);
}

