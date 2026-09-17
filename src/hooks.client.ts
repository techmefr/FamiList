import type { HandleClientError } from '@sveltejs/kit';
import { t } from '$lib/i18n/index.svelte';
import { reportCrash } from '$lib/crash/reporter';

/**
 * Les erreurs de rendu et de navigation.
 *
 * SvelteKit les rattrape avant qu'elles atteignent la fenêtre : sans ce crochet, elles ne
 * déclencheraient jamais l'écouteur `error` du rapporteur, et c'est justement la famille la plus
 * grave — celle qui laisse un écran blanc là où il y avait une page.
 *
 * Le message rendu est traduit. Par défaut SvelteKit affiche « Internal Error », en anglais et
 * pour tout le monde ; on n'y gagne rien à montrer le vrai message, qui est technique et peut
 * porter des données du foyer.
 */
export const handleError: HandleClientError = ({ error, event }) => {
	reportCrash(error, 'render', event.url.pathname);

	return { message: t('common.crashed') };
};
