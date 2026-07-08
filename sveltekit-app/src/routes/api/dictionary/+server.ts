import { proxyDictionaryBytes } from '$lib/server/dictionary-proxy';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch, platform, request }) => {
	const word = url.searchParams.get('word')?.trim() ?? '';
	return proxyDictionaryBytes({ word, fetchFn: fetch, platform, request });
};

export const HEAD: RequestHandler = async (event) => {
	const response = await GET(event);
	return new Response(null, {
		status: response.status,
		headers: response.headers
	});
};
