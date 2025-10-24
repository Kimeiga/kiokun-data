import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

// POST /api/images/upload - Upload an image to R2
export async function POST({ request, locals, platform }: RequestEvent) {
	// Check authentication
	if (!locals.user || !locals.session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const formData = await request.formData();
		const file = formData.get('image') as File;

		if (!file) {
			throw error(400, 'No image file provided');
		}

		// Validate file type
		const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
		if (!allowedTypes.includes(file.type)) {
			throw error(400, 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
		}

		// Validate file size (max 5MB)
		const maxSize = 5 * 1024 * 1024; // 5MB
		if (file.size > maxSize) {
			throw error(400, 'File too large. Maximum size is 5MB.');
		}

		// Generate unique filename
		const timestamp = Date.now();
		const randomString = Math.random().toString(36).substring(2, 15);
		const extension = file.name.split('.').pop() || 'jpg';
		const filename = `${locals.user.id}/${timestamp}-${randomString}.${extension}`;

		// Upload to R2
		const bucket = platform!.env.BUCKET;
		const arrayBuffer = await file.arrayBuffer();
		
		await bucket.put(filename, arrayBuffer, {
			httpMetadata: {
				contentType: file.type,
			},
		});

		// Return the filename (we'll construct the URL on the frontend)
		return json({
			success: true,
			filename,
			url: `/api/images/${filename}`,
		});
	} catch (err) {
		console.error('Image upload error:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to upload image');
	}
}

