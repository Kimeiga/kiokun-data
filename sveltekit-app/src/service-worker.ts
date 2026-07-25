/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { version } from '$service-worker';

const CACHE_NAME = `kiokun-v${version}`;

// Install without downloading every route. The previous full-build precache
// pulled in route-specific JavaScript, the game engine, and a 4 MB tokenizer
// before a learner visited those surfaces. Immutable assets are cached lazily.
self.addEventListener('install', (event: ExtendableEvent) => {
	event.waitUntil(caches.open(CACHE_NAME));
	(self as any).skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
	event.waitUntil(
		caches.keys().then(keys =>
			Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
		)
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

	// Dictionary API: cache-first by app version. Dictionary bytes are large and
	// route navigation should not depend on the browser reaching GitHub raw.
	if (url.pathname === '/api/dictionary' || url.pathname.startsWith('/api/dictionary/')) {
		event.respondWith(
			caches.match(event.request).then(cached => {
				if (cached) return cached;
				return fetch(event.request).then(response => {
					if (response.ok) {
						const clone = response.clone();
						caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
					}
					return response;
				});
			})
		);
		return;
	}

	// Other API calls may be personalized. Do not persist them in the shared
	// browser Cache Storage, where a later signed-in user could receive stale
	// data from a previous session.
	if (url.pathname.startsWith('/api/')) {
		event.respondWith(fetch(event.request));
		return;
	}

	// Dictionary CDN (GitHub raw): cache-first (immutable content)
	if (url.hostname === 'raw.githubusercontent.com') {
		event.respondWith(
			caches.match(event.request).then(cached => {
				if (cached) return cached;
				return fetch(event.request).then(response => {
					if (response.ok) {
						const clone = response.clone();
						caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
					}
					return response;
				});
			})
		);
		return;
	}

	// Static assets: cache-first
	if (url.origin === self.location.origin) {
		event.respondWith(
			caches.match(event.request).then(cached => {
				if (cached) return cached;
				return fetch(event.request).then(response => {
					// Cache only assets the learner actually visits. Versioned
					// application files are immutable; language shards are stable.
					if (response.ok && (
						url.pathname.startsWith('/_app/immutable/') ||
						url.pathname.includes('/pitch/') ||
						url.pathname.includes('/zh_sentences/') ||
						url.pathname.includes('/kr_sentences/')
					)) {
						const clone = response.clone();
						caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
					}
					return response;
				});
			})
		);
		return;
	}
});
