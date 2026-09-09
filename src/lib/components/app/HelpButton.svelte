<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n/index.svelte';
	import { settings } from '$stores/settings.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { CircleQuestionMark, GraduationCap, Lightbulb, Bug, X } from '@lucide/svelte';

	let dialog = $state<HTMLDialogElement | null>(null);

	function show() {
		feedback.play('tap');
		dialog?.showModal();
	}

	function hide() {
		dialog?.close();
	}

	/**
	 * Le tour raconte l'écran ouvert, pas l'application en général : il est choisi à partir du
	 * chemin courant.
	 *
	 * driver.js et sa feuille de style ne descendent qu'ici, à la demande. Ils pèsent une centaine
	 * de kilo-octets pour un besoin qui, chez la plupart des gens, se présente une fois.
	 */
	async function tutoriel() {
		hide();
		const { startTour } = await import('$lib/tour');
		startTour(page.url.pathname, () => settings.setTourSeen(true));
	}

	/**
	 * L'écran ouvert part avec la personne, en paramètre d'URL : c'est ce qui évite de lui demander
	 * de redécrire où elle se trouvait, et ce qui donne au signalement de quoi être reproduit.
	 */
	function signaler(kind: 'bug' | 'suggestion') {
		hide();
		goto(`/report?from=${encodeURIComponent(page.url.pathname)}&kind=${kind}`);
	}

	const ACTIONS = [
		{ key: 'tutorial', icon: GraduationCap, action: tutoriel },
		{ key: 'suggestion', icon: Lightbulb, action: () => signaler('suggestion') },
		{ key: 'bug', icon: Bug, action: () => signaler('bug') }
	] as const;
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
	onclick={show}
	data-test-id="help"
	class="fl-press text-muted-foreground text-label hover:bg-muted flex min-h-[max(2.25rem,36px)] items-center gap-1.5 rounded-full px-3"
>
	<CircleQuestionMark size={18} aria-hidden="true" />
	{t('helpMenu.button')}
</button>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="help-menu-title"
	data-test-id="help-menu"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="help-menu-title" class="text-h2 pe-12 font-semibold">{t('helpMenu.button')}</h2>

		<ul class="mt-4 space-y-1">
			{#each ACTIONS as { key, icon: Icon, action } (key)}
				<li>
					<button
						type="button"
						onclick={action}
						data-test-id="help-menu-{key}"
						class="fl-press hover:bg-muted flex min-h-[max(3.5rem,56px)] w-full items-center gap-3 rounded-lg px-2 text-start"
					>
						<span
							class="bg-[var(--fl-primary-tint)] text-primary grid size-11 shrink-0 place-items-center rounded-full"
						>
							<Icon size={22} aria-hidden="true" />
						</span>
						<span class="text-label font-medium">{t(`helpMenu.${key}`)}</span>
					</button>
				</li>
			{/each}
		</ul>

		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="help-menu-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
