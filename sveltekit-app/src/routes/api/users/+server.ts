import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { user, notes } from "$lib/server/db/schema";
import { sql, desc } from "drizzle-orm";

// GET /api/users - Get all users with their note counts
export async function GET({ platform }: RequestEvent) {
	if (!platform?.env?.DB) {
		throw error(500, "Database not available");
	}

	const db = getDb(platform.env.DB);

	try {
		// Get all users with their note counts
		const usersWithNoteCounts = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				image: user.image,
				createdAt: user.createdAt,
				noteCount: sql<number>`count(${notes.id})`.as('note_count'),
			})
			.from(user)
			.leftJoin(notes, sql`${user.id} = ${notes.userId}`)
			.groupBy(user.id)
			.orderBy(desc(sql`count(${notes.id})`), user.name);

		return json(usersWithNoteCounts);
	} catch (err) {
		console.error("Error fetching users:", err);
		throw error(500, "Failed to fetch users");
	}
}

