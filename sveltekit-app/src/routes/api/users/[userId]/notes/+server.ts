import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { notes, user } from "$lib/server/db/schema";
import { and, asc, count, desc, eq, like, or } from "drizzle-orm";

// GET /api/users/[userId]/notes - Get all notes for a specific user
export async function GET({ params, platform, url }: RequestEvent) {
	const { userId } = params;
	const requestedPage = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
	const requestedPageSize = Number.parseInt(url.searchParams.get("pageSize") ?? "50", 10);
	const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
	const pageSize =
		Number.isFinite(requestedPageSize) && requestedPageSize > 0
			? Math.min(requestedPageSize, 100)
			: 50;
	const query = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
	const requestedSort = url.searchParams.get("sort");
	const sort =
		requestedSort === "created" || requestedSort === "character"
			? requestedSort
			: "updated";

	if (!userId) {
		throw error(400, "User ID parameter is required");
	}

	if (!platform?.env?.DB) {
		throw error(500, "Database not available");
	}

	const db = getDb(platform.env.DB);

	let users;
	try {
		users = await db
			.select({
				id: user.id,
				name: user.name,
				image: user.image,
			})
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
	} catch (err) {
		console.error("Error fetching user profile:", err);
		throw error(500, "Failed to fetch user profile");
	}

	if (users.length === 0) {
		throw error(404, "User not found");
	}

	const searchCondition = query
		? or(like(notes.character, `%${query}%`), like(notes.noteText, `%${query}%`))
		: undefined;
	const whereCondition = searchCondition
		? and(eq(notes.userId, userId), searchCondition)
		: eq(notes.userId, userId);
	const orderBy =
		sort === "created"
			? [desc(notes.createdAt), desc(notes.id)]
			: sort === "character"
				? [asc(notes.character), desc(notes.updatedAt)]
				: [desc(notes.updatedAt), desc(notes.id)];

	try {
		const [totalRows, userNotes] = await Promise.all([
			db
				.select({ total: count() })
				.from(notes)
				.where(whereCondition),
			db
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
				.where(whereCondition)
				.orderBy(...orderBy)
				.limit(pageSize)
				.offset((page - 1) * pageSize)
		]);
		const total = totalRows[0]?.total ?? 0;
		const totalPages = Math.max(1, Math.ceil(total / pageSize));

		return json({
			user: users[0],
			notes: userNotes,
			pagination: {
				page,
				pageSize,
				total,
				totalPages
			}
		});
	} catch (err) {
		console.error("Error fetching user notes:", err);
		throw error(500, "Failed to fetch user notes");
	}
}
