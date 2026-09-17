import { Capacitor } from '@capacitor/core';
import { dev } from '$app/environment';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registers the offline shell, on the web only.
 *
 * The application installed by Capacitor already carries all its files: a service worker would add nothing
 * there and could do harm, by serving the previous version again after an .apk update. Hence registering by
 * hand rather than SvelteKit's, which cannot tell the two apart.
 */
export function registerServiceWorker() {
	if (dev) return;
	if (Capacitor.isNativePlatform()) return;
	if (!('serviceWorker' in navigator)) return;

	navigator.serviceWorker
		// `updateViaCache: 'none'`: the file itself must never come from the HTTP cache, otherwise a broken
		// version would stay in place until its header expired.
		.register('/service-worker.js', { updateViaCache: 'none' })
		.then(registration => {
			// A tab left open for days would never ask for the file again of its own accord: without this
			// reminder, the new worker is not even downloaded.
			setInterval(() => registration.update(), UPDATE_CHECK_MS);
		})
		.catch(() => {
			// Browser in private mode, storage refused: the application works all the same, simply without a
			// first offline launch.
		});
}
