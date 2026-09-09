<script lang="ts">
	import { page } from '$app/state';
	import { t } from '$lib/i18n/index.svelte';
	import { settings } from '$stores/settings.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { CircleQuestionMark } from '@lucide/svelte';

	let occupe = $state(false);

	/**
	 * Le point d'interrogation raconte l'écran ouvert, pas l'application en général : le tour est
	 * choisi à partir du chemin courant.
	 *
	 * driver.js et sa feuille de style ne descendent qu'ici, à la demande. Ils pèsent une centaine
	 * de kilo-octets pour un besoin qui, chez la plupart des gens, se présente une fois.
	 */
	async function aider() {
		if (occupe) return;

		occupe = true;
		feedback.play('tap');

		try {
			const { startTour } = await import('$lib/tour');
			startTour(page.url.pathname, () => settings.setTourSeen(true));
		} finally {
			occupe = false;
		}
	}
</script>

<!--
	Une aide qu'on trouve sans la chercher.

	Elle est au même endroit sur tous les écrans, en haut à droite du contenu : c'est la place où on
	la cherche, et elle ne prend pas un sixième onglet dans une barre qui en supporte cinq. Le
	libellé est visible et non seulement lu par la synthèse vocale — un point d'interrogation seul
	se confond avec une décoration, et c'est précisément la personne qui hésite qui a besoin du mot.
-->
<button
	type="button"
	onclick={aider}
	disabled={occupe}
	data-test-id="help"
	class="fl-press text-muted-foreground text-label hover:bg-muted flex min-h-[max(2.25rem,36px)] items-center gap-1.5 rounded-full px-3"
>
	<CircleQuestionMark size={18} aria-hidden="true" />
	{t('tour.help')}
</button>
