import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { notes, user } from "$lib/server/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/users/[userId]/notes - Get all notes for a specific user
export async function GET({ params, platform }: RequestEvent) {
	// @ts-expect-error - userId param exists in route
	const { userId } = params;

	if (!userId) {
		throw error(400, "User ID parameter is required");
	}

	if (!platform?.env?.DB) {
		throw error(500, "Database not available");
	}

	const db = getDb(platform.env.DB);

	try {
		// First verify the user exists
		const users = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				image: user.image,
			})
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		if (users.length === 0) {
			throw error(404, "User not found");
		}

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
			.where(eq(notes.userId, userId))
			.orderBy(desc(notes.updatedAt));

		return json({
			user: users[0],
			notes: userNotes,
		});
	} catch (err) {
		console.error("Error fetching user notes:", err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, "Failed to fetch user notes");
	}
}

