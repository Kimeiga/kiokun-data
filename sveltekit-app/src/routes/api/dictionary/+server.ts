import { proxyDictionaryBytes } from '$lib/server/dictionary-proxy';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch, platform, request }) => {
	const word = url.searchParams.get('word')?.trim() ?? '';
	const response = await proxyDictionaryBytes({ word, fetchFn: fetch, platform, request });

	if (url.searchParams.get('optional') === '1' && response.status === 404) {
		return new Response(null, {
			status: 204,
			headers: {
				'Cache-Control': 'public, max-age=300'
			}
		});
	}

	return response;
};

export const HEAD: RequestHandler = async (event) => {
	const response = await GET(event);
	return new Response(null, {
		status: response.status,
		headers: response.headers
	});
};
