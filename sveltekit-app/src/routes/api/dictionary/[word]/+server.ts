import { getJsDelivrUrl, getRawGitHubUrl } from '$lib/shard-utils';
import type { RequestHandler } from './$types';

const DICTIONARY_CACHE_SECONDS = 60 * 60 * 24;
const STALE_SECONDS = 60 * 60 * 24 * 7;
const SUFFIX = '.json.deflate';

function wordFromParam(param: string): string {
	return param.endsWith(SUFFIX) ? param.slice(0, -SUFFIX.length) : param;
}

function cacheHeaders(): Headers {
	return new Headers({
		'content-type': 'application/octet-stream',
		'cache-control': `public, max-age=3600, s-maxage=${DICTIONARY_CACHE_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`,
		'access-control-allow-origin': '*'
	});
}

function upstreamErrorStatus(status: number): number {
	if (status === 404) return 404;
	if (status === 429) return 503;
	if (status >= 500) return 502;
	return status;
}

export const GET: RequestHandler = async ({ params, fetch, platform, request }) => {
	const word = wordFromParam(params.word);
	if (!word) return new Response('Dictionary word is required', { status: 400 });

	const cache = platform?.caches?.default;
	const cacheKey = new Request(new URL(request.url).toString(), request);
	const cached = await cache?.match(cacheKey);
	if (cached) return cached;

	let upstream = await fetch(getRawGitHubUrl(word));
	if (!upstream.ok && upstream.status !== 404) {
		upstream = await fetch(getJsDelivrUrl(word));
	}

	if (!upstream.ok) {
		return new Response(`Dictionary upstream returned ${upstream.status}`, {
			status: upstreamErrorStatus(upstream.status)
		});
	}

	const response = new Response(upstream.body, {
		status: 200,
		headers: cacheHeaders()
	});

	platform?.context?.waitUntil(cache?.put(cacheKey, response.clone()) ?? Promise.resolve());
	return response;
};

export const HEAD: RequestHandler = async (event) => {
	const response = await GET(event);
	return new Response(null, {
		status: response.status,
		headers: response.headers
	});
};
