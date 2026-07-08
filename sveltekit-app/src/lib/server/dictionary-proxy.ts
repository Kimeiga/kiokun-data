import { getJsDelivrUrl, getRawGitHubUrl } from '$lib/shard-utils';

const DICTIONARY_CACHE_SECONDS = 60 * 60 * 24;
const STALE_SECONDS = 60 * 60 * 24 * 7;

type FetchLike = typeof fetch;

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

export async function proxyDictionaryBytes({
	word,
	fetchFn,
	platform,
	request
}: {
	word: string;
	fetchFn: FetchLike;
	platform?: App.Platform;
	request: Request;
}): Promise<Response> {
	if (!word) return new Response('Dictionary word is required', { status: 400 });

	const cache = platform?.caches?.default;
	const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });
	const cached = await cache?.match(cacheKey);
	if (cached) return cached;

	let upstream = await fetchFn(getRawGitHubUrl(word));
	if (!upstream.ok && upstream.status !== 404) {
		upstream = await fetchFn(getJsDelivrUrl(word));
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
}
