/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { base, build, files, version } from '$service-worker';

/**
 * Offline shell.
 *
 * The household's data is already served by Dexie and the sync queue: this file only deals with the HTML,
 * the JS and the CSS, that is, with the very first launch without network, the one where IndexedDB is
 * still empty and the browser has nothing to show.
 */

const worker = self as unknown as ServiceWorkerGlobalScope;

// `version` changes on every build: one cache per version, and the old ones are destroyed on activation.
// Without that, an update would leave people on a frozen shell, which is worse than no service worker at
// all.
const CACHE = `familist-${version}`;

// The entry page is in neither `build` nor `files`: adapter-static produces it as `fallback`, and the host
// returns it for any route. It is the one to keep.
const ENTRY = `${base}/`;
const PRECACHE = [ENTRY, ...build, ...files];

worker.addEventListener('install', event => {
// No `skipWaiting()`: an open tab keeps running on the code fragments of its own version, which stay in
// its cache. The new worker takes over at the next cold start.
	event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
});

worker.addEventListener('activate', event => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
			await worker.clients.claim();
		})()
	);
});

async function cacheFirst(request: Request, key: string) {
	const cache = await caches.open(CACHE);
	const cached = await cache.match(key);
	if (cached) return cached;

	const response = await fetch(request);

	// An error response is still a response: keeping it would make today's outage tomorrow's offline version.
	if (response.ok) cache.put(key, response.clone());

	return response;
}

async function networkFirst(request: Request, fallback: string) {
	try {
		return await fetch(request);
	} catch (error) {
		const cache = await caches.open(CACHE);
		const cached = (await cache.match(request)) ?? (await cache.match(fallback));
		if (cached) return cached;

		throw error;
	}
}

worker.addEventListener('fetch', event => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	// Everything outside the domain — Supabase first — passes without us: it is the sync engine that knows
	// what to do with a failed network call, not a shell cache.
	if (url.origin !== worker.location.origin) return;
	if (!url.protocol.startsWith('http')) return;

	// The build files carry their fingerprint in their name: their content never changes, so the cache is the
	// authority and a network round trip is avoided.
	if (build.includes(url.pathname) || files.includes(url.pathname)) {
		event.respondWith(cacheFirst(request, url.pathname));
		return;
	}

	// A navigation falls back on the entry page: the host already rewrites every route to it, and the client
	// router does the rest once the shell is shown.
	event.respondWith(networkFirst(request, ENTRY));
});
