import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { userLearningSettings } from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!platform?.env?.DB) throw error(500, 'Database not available');

	const db = getDb(platform.env.DB);
	const rows = await db
		.select()
		.from(userLearningSettings)
		.where(eq(userLearningSettings.userId, locals.user.id))
		.limit(1);
	return json({ autoSaveSentences: rows[0]?.autoSaveSentences ?? false });
};
export const PATCH: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	if (!platform?.env?.DB) throw error(500, 'Database not available');

	const body = await request.json().catch(() => null);
	if (typeof body?.autoSaveSentences !== 'boolean') {
		throw error(400, 'autoSaveSentences must be a boolean');
	}

	const db = getDb(platform.env.DB);
	const now = new Date();
	await db.insert(userLearningSettings).values({
		userId: locals.user.id,
		autoSaveSentences: body.autoSaveSentences,
		createdAt: now,
		updatedAt: now,
	}).onConflictDoUpdate({
		target: userLearningSettings.userId,
		set: {
			autoSaveSentences: body.autoSaveSentences,
			updatedAt: now,
		},
	});

	return json({ autoSaveSentences: body.autoSaveSentences });
};
