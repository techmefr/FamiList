import type { HandleClientError } from '@sveltejs/kit';
import { t } from '$lib/i18n/index.svelte';
import { reportCrash } from '$lib/crash/reporter';

/**
 * Rendering and navigation errors.
 *
 * SvelteKit catches them before they reach the window: without this hook, they would never trigger the
 * reporter's `error` listener, and they are precisely the most serious family — the one leaving a blank
 * screen where there was a page.
 *
 * The message returned is translated. By default SvelteKit shows "Internal Error", in English and for
 * everybody; we gain nothing by showing the real message, which is technical and may carry household data.
 */
export const handleError: HandleClientError = ({ error, event }) => {
	reportCrash(error, 'render', event.url.pathname);

	return { message: t('common.crashed') };
};
