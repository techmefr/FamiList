import { Capacitor } from '@capacitor/core';
import { dev } from '$app/environment';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Enregistre la coquille hors-ligne, côté web uniquement.
 *
 * L'application installée par Capacitor embarque déjà tous ses fichiers : un service worker n'y
 * apporterait rien et pourrait faire du mal, en resservant la version d'avant après une mise à
 * jour du .apk. D'où l'enregistrement à la main plutôt que celui de SvelteKit, qui ne sait pas
 * distinguer les deux.
 */
export function registerServiceWorker() {
	if (dev) return;
	if (Capacitor.isNativePlatform()) return;
	if (!('serviceWorker' in navigator)) return;

	navigator.serviceWorker
		// `updateViaCache: 'none'` : le fichier lui-même ne doit jamais venir du cache HTTP, sinon
		// une version cassée resterait en place jusqu'à expiration de son en-tête.
		.register('/service-worker.js', { updateViaCache: 'none' })
		.then(registration => {
			// Un onglet laissé ouvert des jours ne redemanderait jamais le fichier de sa propre
			// initiative : sans ce rappel, le nouveau worker n'est même pas téléchargé.
			setInterval(() => registration.update(), UPDATE_CHECK_MS);
		})
		.catch(() => {
			// Navigateur en navigation privée, stockage refusé : l'application marche quand même,
			// simplement sans premier lancement hors-ligne.
		});
}
