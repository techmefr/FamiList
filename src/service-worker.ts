/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { base, build, files, version } from '$service-worker';

/**
 * Coquille hors-ligne.
 *
 * Les données du foyer sont déjà servies par Dexie et la file de synchronisation : ce fichier ne
 * s'occupe que du HTML, du JS et du CSS, c'est-à-dire du tout premier lancement sans réseau, celui
 * où IndexedDB est encore vide et où le navigateur n'a rien à afficher.
 */

const worker = self as unknown as ServiceWorkerGlobalScope;

// `version` change à chaque build : un cache par version, et les anciens sont détruits à
// l'activation. Sans ça, une mise à jour laisserait les gens sur une coquille figée, ce qui est
// pire que pas de service worker du tout.
const CACHE = `familist-${version}`;

// La page d'entrée n'est ni dans `build` ni dans `files` : adapter-static la produit comme
// `fallback`, et l'hébergeur la renvoie pour n'importe quelle route. C'est elle qu'il faut garder.
const ENTRY = `${base}/`;
const PRECACHE = [ENTRY, ...build, ...files];

worker.addEventListener('install', event => {
	// Pas de `skipWaiting()` : un onglet ouvert continue de tourner sur les fragments de code de sa
	// propre version, qui restent dans son cache. Le nouveau worker prend la main à la prochaine
	// ouverture à froid.
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

	// Une réponse d'erreur reste une réponse : la garder ferait de la panne du jour la version
	// hors-ligne de demain.
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

	// Tout ce qui sort du domaine — Supabase en premier — passe sans nous : c'est le moteur de
	// synchronisation qui sait quoi faire d'un appel réseau raté, pas un cache de coquille.
	if (url.origin !== worker.location.origin) return;
	if (!url.protocol.startsWith('http')) return;

	// Les fichiers du build portent leur empreinte dans leur nom : leur contenu ne change jamais,
	// le cache fait donc autorité et évite un aller-retour réseau.
	if (build.includes(url.pathname) || files.includes(url.pathname)) {
		event.respondWith(cacheFirst(request, url.pathname));
		return;
	}

	// Une navigation retombe sur la page d'entrée : l'hébergeur réécrit déjà toutes les routes vers
	// elle, et le routeur client fait le reste une fois la coquille affichée.
	event.respondWith(networkFirst(request, ENTRY));
});
