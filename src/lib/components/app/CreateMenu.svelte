<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { settings } from '$stores/settings.svelte';
	import { createIntent, type CreateKind } from '$stores/create.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { ShoppingBasket, ListPlus, LayoutList, Store, CreditCard, X } from '@lucide/svelte';

	let dialog = $state<HTMLDialogElement | null>(null);

	/**
	 * `<dialog>` natif plutôt qu'une surcouche : le navigateur pose le voile, enferme le clavier dans
	 * la feuille, rend le reste de la page inerte pour les lecteurs d'écran et ferme sur Échap. Ce
	 * sont exactement les quatre comportements qu'une <div> obligerait à réécrire, et à rater.
	 *
	 * Ouverture et fermeture passent par ces deux fonctions, sans booléen en parallèle. Un miroir de
	 * l'état aurait fini par mentir : Échap ferme la feuille sans passer par nous, et il suffit d'un
	 * évènement `close` manqué pour que le bouton reste convaincu qu'elle est déjà ouverte et cesse
	 * de répondre. Ici la seule vérité est celle du navigateur.
	 */
	export function show() {
		dialog?.showModal();
	}

	function hide() {
		dialog?.close();
	}

	/**
	 * Un article se range dans une liste : celle qui est ouverte, sinon la dernière créée. Sans
	 * aucune liste, la proposition n'a pas de sens et disparaît — c'est « Nouvelle liste » qui
	 * devient alors le premier geste.
	 */
	function itemTarget() {
		const current = page.url.pathname.match(/^\/l\/([^/]+)/)?.[1];
		if (current) return `/l/${current}`;

		const last = data.lists.at(-1);
		return last ? `/l/${last.id}` : null;
	}

	const ACTIONS = [
		{ kind: 'item', icon: ShoppingBasket, target: itemTarget, field: null },
		{ kind: 'list', icon: ListPlus, target: () => '/', field: '[data-test-id="list-name"]' },
		{ kind: 'aisle', icon: LayoutList, target: () => '/shops', field: '[data-test-id="aisle-name"]' },
		{ kind: 'shop', icon: Store, target: () => '/shops', field: '[data-test-id="shop-name"]' },
		{ kind: 'card', icon: CreditCard, target: () => '/cards', field: '[data-test-id="card-name"]' }
	] satisfies { kind: CreateKind; icon: unknown; target: () => string | null; field: string | null }[];

	const available = $derived(ACTIONS.filter((action) => action.target() !== null));

	/**
	 * Le champ n'existe pas toujours quand la navigation se termine : l'accueil et les cartes
	 * déplient leur formulaire à l'effet suivant. On réessaie quelques fois plutôt que de parier sur
	 * un délai unique.
	 *
	 * `setTimeout` et non `requestAnimationFrame` : le second ne se déclenche pas dans un onglet
	 * caché, et une création lancée juste avant un changement d'application laisserait le curseur
	 * nulle part.
	 */
	function focusField(selector: string, tries = 12) {
		const field = document.querySelector<HTMLElement>(selector);

		if (field) {
			field.focus();
			field.scrollIntoView({ block: 'center', behavior: settings.animates ? 'smooth' : 'auto' });
			return;
		}

		if (tries > 0) setTimeout(() => focusField(selector, tries - 1), 24);
	}

	async function choose(action: (typeof ACTIONS)[number]) {
		const href = action.target();
		if (!href) return;

		feedback.play('tap');
		hide();
		createIntent.request(action.kind);

		await goto(href);
		await tick();

		// L'article ouvre une feuille, qui place elle-même son focus. Les autres déplient un
		// formulaire déjà dans la page : là, il faut aller y poser le curseur.
		if (action.field) focusField(action.field);
	}
</script>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		// La feuille est transparente et ne fait que la taille de la carte : un clic qui l'atteint
		// elle-même vient du voile, donc d'à côté. On ferme, comme le ferait n'importe quelle feuille.
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="create-title"
	data-test-id="create-menu"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="create-title" class="text-h2 pe-12 font-semibold">{t('create.title')}</h2>

		<ul class="mt-4 space-y-1">
			{#each available as action (action.kind)}
				{@const Icon = action.icon}
				<li>
					<button
						type="button"
						onclick={() => choose(action)}
						data-test-id="create-{action.kind}"
						class="fl-press hover:bg-muted flex min-h-[max(3.5rem,56px)] w-full items-center gap-3 rounded-lg px-2 text-start"
					>
						<span
							class="bg-[var(--fl-primary-tint)] text-primary grid size-11 shrink-0 place-items-center rounded-full"
						>
							<Icon size={22} aria-hidden="true" />
						</span>
						<span class="text-label font-medium">{t(`create.${action.kind}`)}</span>
					</button>
				</li>
			{/each}
		</ul>

		<!--
			La fermeture vient après la liste dans le document, même si elle s'affiche en haut à droite.
			Le navigateur donne le premier focus au premier élément atteignable : mieux vaut que ce soit
			un choix que la sortie, sinon une entrée au clavier referme la feuille aussitôt ouverte.
		-->
		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="create-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
