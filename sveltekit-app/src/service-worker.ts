/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { version } from '$service-worker';
import { getJsDelivrUrl } from '$lib/shard-utils';

const CACHE_PREFIX = 'kiokun-v';
const CACHE_NAME = `${CACHE_PREFIX}${version}`;
const PREVIOUS_APP_CACHE_COUNT = 2;

function cacheInBackground(event: FetchEvent, request: Request, response: Response): void {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.put(request, response))
			.catch((cause) => console.warn('Service worker cache write failed:', cause))
	);
}

async function matchCached(request: Request): Promise<Response | undefined> {
	try {
		return await caches.match(request);
	} catch (cause) {
		console.warn('Service worker cache read failed:', cause);
		return undefined;
	}
}

function dictionaryCacheRequest(request: Request): Request {
	const url = new URL(request.url);
	const word = url.searchParams.get('word') || '';
	url.pathname = '/api/dictionary';
	url.search = '';
	url.searchParams.set('word', word);
	return new Request(url, { method: 'GET' });
}

async function fetchDictionary(
	event: FetchEvent,
	url: URL
): Promise<Response> {
	const cacheRequest = dictionaryCacheRequest(event.request);
	const cached = await matchCached(cacheRequest);
	if (cached) return cached;

	let response: Response | null = null;
	try {
		response = await fetch(event.request);
	} catch {
		// The CDN fallback below also covers a rejected same-origin fetch.
	}

	if (response?.status === 200) {
		cacheInBackground(event, cacheRequest, response.clone());
		return response;
	}

	if (!response || response.status === 429 || response.status >= 500) {
		const word = url.searchParams.get('word')?.trim();
		if (word) {
			try {
				const fallback = await fetch(getJsDelivrUrl(word));
				if (fallback.ok) {
					cacheInBackground(event, cacheRequest, fallback.clone());
					return fallback;
				}
			} catch {
				// Return the same-origin error below when both providers are unavailable.
			}
		}
	}

	return response ?? new Response('Dictionary network unavailable', {
		status: 503,
		headers: { 'cache-control': 'no-store' }
	});
}

async function cacheFirst(event: FetchEvent): Promise<Response> {
	const cached = await matchCached(event.request);
	if (cached) return cached;

	try {
		const response = await fetch(event.request);
		if (response.ok) cacheInBackground(event, event.request, response.clone());
		return response;
	} catch {
		// Resolve the FetchEvent promise even when the network is unavailable. A
		// Response.error() still tells the caller the asset failed without producing
		// an additional uncaught service-worker rejection.
		return Response.error();
	}
}

function isCacheableStaticPath(pathname: string): boolean {
	return pathname.startsWith('/_app/immutable/') ||
		pathname.startsWith('/category_data/') ||
		pathname.startsWith('/game_data/') ||
		pathname.startsWith('/pitch/') ||
		pathname.startsWith('/reel-index/') ||
		pathname.startsWith('/zh_sentences/') ||
		pathname.startsWith('/kr_sentences/');
}

function isDictionaryCdnUrl(url: URL): boolean {
	return (
		url.hostname === 'raw.githubusercontent.com' &&
		url.pathname.startsWith('/Kimeiga/kiokun2-dict-')
	) || (
		url.hostname === 'cdn.jsdelivr.net' &&
		url.pathname.startsWith('/gh/Kimeiga/kiokun2-dict-')
	);
}

// Install without downloading every route. The previous full-build precache
// pulled in route-specific JavaScript, the game engine, and a 4 MB tokenizer
// before a learner visited those surfaces. Immutable assets are cached lazily.
self.addEventListener('install', (event: ExtendableEvent) => {
	event.waitUntil(caches.open(CACHE_NAME));
	(self as any).skipWaiting();
});

// Keep two previous application caches so tabs left open during a deployment
// can still load their hashed modules. The client also refreshes once when Vite
// reports a missing preload, covering tabs older than this retention window.
self.addEventListener('activate', (event: ExtendableEvent) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			const applicationCaches = keys.filter((key) => key.startsWith(CACHE_PREFIX));
			const previousCaches = applicationCaches.filter((key) => key !== CACHE_NAME);
			const retainedPreviousCaches = new Set(previousCaches.slice(-PREVIOUS_APP_CACHE_COUNT));
			return Promise.all(
				applicationCaches
					.filter((key) => key !== CACHE_NAME && !retainedPreviousCaches.has(key))
					.map((key) => caches.delete(key))
			);
		})
	);
	(self as any).clients.claim();
});

// Fetch: network-first for API, cache-first for static assets
self.addEventListener('fetch', (event: FetchEvent) => {
	const url = new URL(event.request.url);

	// Skip non-GET requests
	if (event.request.method !== 'GET') return;

	// Let SSR document navigations go straight to the network. The service worker
	// does not cache HTML pages, so intercepting them only adds latency/staleness risk.
	if (event.request.mode === 'navigate') return;

	// Dictionary API: cache successful bytes under a stable word-only key and
	// retry transient same-origin failures through the public CDN. This request is
	// required for client-side dictionary navigation.
	if (url.pathname === '/api/dictionary' || url.pathname.startsWith('/api/dictionary/')) {
		event.respondWith(fetchDictionary(event, url));
		return;
	}

	// Other API calls may be personalized. Leave them to the browser instead of
	// wrapping them in an equivalent fetch promise; that wrapper turned ordinary
	// network failures into uncaught FetchEvent rejections.
	if (url.pathname.startsWith('/api/')) {
		return;
	}

	// Dictionary CDN responses are immutable between application deployments.
	if (isDictionaryCdnUrl(url)) {
		event.respondWith(cacheFirst(event));
		return;
	}

	// Cache only explicit static asset families. In particular, do not intercept
	// same-origin route/data fetches such as /逃; SvelteKit must own their failure
	// and recovery semantics.
	if (url.origin === self.location.origin && isCacheableStaticPath(url.pathname)) {
		event.respondWith(cacheFirst(event));
		return;
	}
});
