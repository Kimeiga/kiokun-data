/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const CACHE_NAME = `kiokun-v${version}`;

// Static assets to cache immediately
const PRECACHE = [
	...build,  // JS/CSS bundles
	...files.filter(f =>
		f.endsWith('.json') && !f.includes('zh_sentences') && !f.includes('kr_sentences') && !f.includes('pitch/') &&
		!f.includes('homophones_') && !f.includes('video_data') && !f.includes('reel_transcripts')
	),
];

// Install: precache static assets
self.addEventListener('install', (event: ExtendableEvent) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
	);
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

	// API calls: network-first with cache fallback
	if (url.pathname.startsWith('/api/')) {
		event.respondWith(
			fetch(event.request)
				.then(response => {
					// Cache successful GET API responses for offline
					if (response.ok) {
						const clone = response.clone();
						caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
					}
					return response;
				})
				.catch(() => caches.match(event.request).then(r => r || new Response('Offline', { status: 503 })))
		);
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
					// Cache pitch accent shards, sentence data, etc.
					if (response.ok && (url.pathname.includes('/pitch/') || url.pathname.includes('/zh_sentences/') || url.pathname.includes('/kr_sentences/'))) {
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
