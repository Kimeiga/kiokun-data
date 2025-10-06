import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generatePresignedDownloadUrl } from '$lib/utils/r2-presign';

/**
 * GET /api/notes
 * Fetch all notes from D1 database
 */
export const GET: RequestHandler = async ({ platform }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	try {
		const result = await platform.env.DB.prepare(
			'SELECT * FROM notes ORDER BY created_at DESC LIMIT 50'
		).all();

		// Generate presigned URLs for images if they exist
		const notesWithImages = await Promise.all(
			result.results.map(async (note: any) => {
				if (note.image_key && platform.env.R2_ACCESS_KEY_ID) {
					try {
						const imageUrl = await generatePresignedDownloadUrl(
							platform.env.R2_ACCESS_KEY_ID,
							platform.env.R2_SECRET_ACCESS_KEY,
							platform.env.R2_ACCOUNT_ID,
							'kiokun-images',
							note.image_key,
							3600 // 1 hour expiry
						);
						return { ...note, image_url: imageUrl };
					} catch (error) {
						console.error('Error generating presigned URL:', error);
						return note;
					}
				}
				return note;
			})
		);

		return json({
			notes: notesWithImages,
			success: true
		});
	} catch (error) {
		console.error('Error fetching notes:', error);
		return json({ error: 'Failed to fetch notes' }, { status: 500 });
	}
};

/**
 * POST /api/notes
 * Create a new note in D1 database
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	try {
		const body = await request.json();
		const { text, image_key } = body;

		if (!text) {
			return json({ error: 'Text is required' }, { status: 400 });
		}

		const id = crypto.randomUUID();
		const created_at = Date.now();

		await platform.env.DB.prepare(
			'INSERT INTO notes (id, text, image_key, created_at) VALUES (?, ?, ?, ?)'
		)
			.bind(id, text, image_key || null, created_at)
			.run();

		return json({
			success: true,
			note: {
				id,
				text,
				image_key,
				created_at
			}
		});
	} catch (error) {
		console.error('Error creating note:', error);
		return json({ error: 'Failed to create note' }, { status: 500 });
	}
};

/**
 * DELETE /api/notes
 * Delete a note by ID
 */
export const DELETE: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	try {
		const body = await request.json();
		const { id } = body;

		if (!id) {
			return json({ error: 'Note ID is required' }, { status: 400 });
		}

		// Get the note to check if it has an image
		const note = await platform.env.DB.prepare('SELECT image_key FROM notes WHERE id = ?')
			.bind(id)
			.first();

		// Delete the note from database
		await platform.env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();

		// Optionally delete the image from R2
		if (note?.image_key && platform.env.BUCKET) {
			try {
				await platform.env.BUCKET.delete(note.image_key);
			} catch (error) {
				console.error('Error deleting image from R2:', error);
				// Continue even if image deletion fails
			}
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting note:', error);
		return json({ error: 'Failed to delete note' }, { status: 500 });
	}
};

