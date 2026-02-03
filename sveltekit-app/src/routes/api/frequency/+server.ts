import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';

/**
 * GET /api/frequency
 *
 * DEPRECATED: This endpoint is deprecated. The frequency data is now served as a static file.
 * Redirects to /frequency_list.json for backwards compatibility.
 *
 * Note: fs.readFileSync does not work on Cloudflare Workers, so we now serve
 * the frequency list as a static file instead.
 */
export const GET: RequestHandler = async () => {
	// Redirect to the static file
	throw redirect(301, '/frequency_list.json');
};
