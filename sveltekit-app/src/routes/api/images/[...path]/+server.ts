import { error } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

// GET /api/images/[...path] - Serve an image from R2
export async function GET({ params, platform }: RequestEvent) {
	const { path } = params;

	if (!path) {
		throw error(400, 'Image path is required');
	}

	try {
		const bucket = platform!.env.BUCKET;
		const object = await bucket.get(path);

		if (!object) {
			throw error(404, 'Image not found');
		}

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set('etag', object.httpEtag);
		headers.set('cache-control', 'public, max-age=31536000, immutable');

		return new Response(object.body, {
			headers,
		});
	} catch (err) {
		console.error('Image fetch error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to fetch image');
	}
}

// DELETE /api/images/[...path] - Delete an image from R2
export async function DELETE({ params, locals, platform }: RequestEvent) {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw error(401, 'Unauthorized');
	}

	const { path } = params;

	if (!path) {
		throw error(400, 'Image path is required');
	}

	// Verify the user owns this image (path should start with their user ID)
	if (!path.startsWith(locals.user.id + '/')) {
		throw error(403, 'Forbidden: You can only delete your own images');
	}

	try {
		const bucket = platform!.env.BUCKET;
		await bucket.delete(path);

		return new Response(null, { status: 204 });
	} catch (err) {
		console.error('Image delete error:', err);
		throw error(500, 'Failed to delete image');
	}
}

