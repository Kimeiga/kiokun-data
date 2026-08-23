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

function cacheKeyForWord(request: Request, word: string): Request {
	const url = new URL(request.url);
	url.pathname = '/api/dictionary';
	url.search = '';
	url.searchParams.set('word', word);
	return new Request(url, { method: 'GET' });
}

async function safeCacheMatch(
	cache: Cache | undefined,
	cacheKey: Request
): Promise<Response | undefined> {
	try {
		return await cache?.match(cacheKey);
	} catch (cause) {
		console.warn('Dictionary edge cache read failed:', cause);
		return undefined;
	}
}

async function fetchUpstream(
	fetchFn: FetchLike,
	url: string
): Promise<Response | null> {
	try {
		return await fetchFn(url);
	} catch (cause) {
		console.warn(`Dictionary upstream fetch failed for ${new URL(url).hostname}:`, cause);
		return null;
	}
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
	// Build IDs and the optional-probe flag are client concerns. Keeping either in
	// the edge cache key cold-started the same dictionary entry after every deploy
	// and prevented speculative lookups from sharing a successful response.
	const cacheKey = cacheKeyForWord(request, word);
	const cached = await safeCacheMatch(cache, cacheKey);
	if (cached) return cached;

	let upstream = await fetchUpstream(fetchFn, getRawGitHubUrl(word));
	// A raw GitHub 404 is authoritative. Network errors, throttling, and upstream
	// 5xx responses are retried through jsDelivr so a transient provider problem
	// cannot abort client-side navigation.
	if (!upstream || (!upstream.ok && upstream.status !== 404)) {
		upstream = await fetchUpstream(fetchFn, getJsDelivrUrl(word));
	}

	if (!upstream || !upstream.ok) {
		const status = upstream?.status ?? 503;
		return new Response(`Dictionary upstream returned ${status}`, {
			status: upstreamErrorStatus(status),
			headers: { 'cache-control': 'no-store' }
		});
	}

	const response = new Response(upstream.body, {
		status: 200,
		headers: cacheHeaders()
	});

	if (cache) {
		const cacheWrite = cache.put(cacheKey, response.clone()).catch((cause) => {
			console.warn('Dictionary edge cache write failed:', cause);
		});
		if (platform?.context) platform.context.waitUntil(cacheWrite);
		else void cacheWrite;
	}
	return response;
}
