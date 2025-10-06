import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generatePresignedUploadUrl, generateFileKey } from '$lib/utils/r2-presign';

/**
 * POST /api/uploads
 * Generate a presigned URL for uploading to R2
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.R2_ACCESS_KEY_ID) {
		return json({ error: 'R2 credentials not configured' }, { status: 500 });
	}

	try {
		const body = await request.json();
		const { filename, contentType } = body;

		if (!filename || !contentType) {
			return json({ error: 'filename and contentType are required' }, { status: 400 });
		}

		// Validate content type (only allow images)
		if (!contentType.startsWith('image/')) {
			return json({ error: 'Only image files are allowed' }, { status: 400 });
		}

		// Generate a unique key for the file
		const key = generateFileKey(filename);

		// Generate presigned URL
		const uploadUrl = await generatePresignedUploadUrl(
			platform.env.R2_ACCESS_KEY_ID,
			platform.env.R2_SECRET_ACCESS_KEY,
			platform.env.R2_ACCOUNT_ID,
			'kiokun-images',
			key,
			contentType,
			3600 // 1 hour expiry
		);

		return json({
			uploadUrl,
			key,
			success: true
		});
	} catch (error) {
		console.error('Error generating presigned URL:', error);
		return json({ error: 'Failed to generate upload URL' }, { status: 500 });
	}
};

