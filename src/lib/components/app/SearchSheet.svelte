<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { settings } from '$stores/settings.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { flattenHits, searchAll, MIN_QUERY_LENGTH, type SearchHit } from '$domain/search';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Search, X, Check, ListChecks, ShoppingBasket, Store, CreditCard } from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';

	let dialog = $state<HTMLDialogElement | null>(null);
	let field = $state<HTMLInputElement | null>(null);
	let query = $state('');

	/**
	 * Le résultat désigné au clavier. Les flèches le déplacent, Entrée l'ouvre ; la souris n'y
	 * touche pas — survoler une ligne en cherchant du regard déplacerait la cible de la touche
	 * Entrée sous les doigts de quelqu'un qui ne regarde pas la souris.
	 */
	let actif = $state(0);

	/**
	 * Tout se joue sur le cache local : les listes, les articles, les magasins et les cartes sont
	 * déjà en mémoire, et le foyer d'une famille se compte en centaines de lignes. Interroger le
	 * serveur rendrait la recherche inutilisable là où elle sert le plus — debout dans un rayon,
	 * avec une barre de réseau.
	 */
	const groups = $derived(
		searchAll(query, {
			lists: data.lists,
			items: data.items,
			shops: data.shops,
			cards: data.cards
		})
	);

	const hits = $derived(flattenHits(groups));
	const tapeAssez = $derived(query.trim().length >= MIN_QUERY_LENGTH);

	const ICONS = {
		list: ListChecks,
		item: ShoppingBasket,
		shop: Store,
		card: CreditCard
	};

	export async function show() {
		query = '';
		actif = 0;
		dialog?.showModal();

		// Comme la palette d'emoji : `showModal` pose le focus lui-même, on ne le déplace qu'après.
		await tick();
		field?.focus();
	}

	function hide() {
		dialog?.close();
	}

	function open(hit: SearchHit) {
		feedback.play('tap');
		hide();
		void goto(hit.href);
	}

	/**
	 * Les flèches parcourent la suite des résultats sans quitter le champ : on continue à corriger
	 * sa frappe pendant qu'on regarde descendre la sélection. Le tour est bouclé — arrivé en bas,
	 * la flèche suivante revient en haut, ce qui évite d'avoir à compter les lignes pour remonter.
	 */
	function surTouche(event: KeyboardEvent) {
		if (hits.length === 0) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			actif = (actif + 1) % hits.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			actif = (actif - 1 + hits.length) % hits.length;
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const hit = hits[actif];
			if (hit) open(hit);
		}
	}

	// Une frappe de plus refait la liste : la sélection doit repartir du premier résultat, sinon
	// Entrée ouvrirait la troisième ligne d'une liste qui n'existe plus.
	$effect(() => {
		void query;
		actif = 0;
	});

	const optionId = (index: number) => `search-hit-${index}`;
</script>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="search-title"
	data-test-id="search-sheet"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="search-title" class="text-h2 pe-12 font-semibold">{t('search.title')}</h2>

		<div class="mt-4">
			<Label for="search-query">{t('search.label')}</Label>
			<IconField icon={Search}>
				<Input
					id="search-query"
					bind:ref={field}
					bind:value={query}
					onkeydown={surTouche}
					type="search"
					placeholder={t('search.placeholder')}
					data-test-id="search-query"
					autocomplete="off"
					role="combobox"
					aria-expanded={hits.length > 0}
					aria-controls="search-results"
					aria-activedescendant={hits.length > 0 ? optionId(actif) : undefined}
				/>
			</IconField>
		</div>

		<!-- Le décompte est dit par la synthèse vocale, pas affiché : la liste le montre déjà. -->
		<p class="sr-only" aria-live="polite" data-test-id="search-count">
			{tapeAssez ? t('search.count', { count: hits.length }) : ''}
		</p>

		<!--
			Hauteur bornée et défilement interne, comme la palette : sans cela, une douzaine de
			résultats pousserait le champ de recherche hors de l'écran, sur téléphone, clavier ouvert.
		-->
		<div class="mt-3 max-h-[55vh] overflow-y-auto pe-1">
			{#if !tapeAssez}
				<p class="text-muted-foreground text-label py-6 text-center" data-test-id="search-hint">
					{t('search.hint', { count: MIN_QUERY_LENGTH })}
				</p>
			{:else if hits.length === 0}
				<EmptyState illustration="inbox" text={t('search.empty')} testId="search-empty" />
			{:else}
				<ul id="search-results" role="listbox" aria-label={t('search.title')}>
					{#each groups as group (group.kind)}
						{@const Icon = ICONS[group.kind]}
						<li role="presentation">
							<h3
								class="text-caption text-muted-foreground mt-3 flex items-center gap-1.5 font-medium first:mt-0"
							>
								<Icon size={13} aria-hidden="true" />
								{t(`search.group.${group.kind}`)}
							</h3>
							<ul role="presentation" class="mt-1 space-y-1">
								{#each group.hits as hit (hit.id)}
									{@const index = hits.indexOf(hit)}
									<li role="presentation" data-test-class="search-hit">
										<!--
											Un bouton, pas un lien : la feuille doit se refermer avant la navigation,
											sinon on revient sur une page recouverte d'un panneau de résultats périmés.
											Le clavier passe par le champ et les flèches, jamais par la tabulation d'une
											ligne à l'autre — d'où `tabindex="-1"`, qui laisse Échap et Entrée là où le
											doigt est déjà.
										-->
										<button
											type="button"
											id={optionId(index)}
											role="option"
											aria-selected={index === actif}
											tabindex="-1"
											onclick={() => open(hit)}
											class="fl-press hover:bg-muted flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start
												{index === actif ? 'bg-muted ring-primary ring-2' : ''}"
										>
											{#if hit.icon}
												<span class="text-h2 shrink-0" aria-hidden="true">{hit.icon}</span>
											{/if}
											<span class="min-w-0 flex-1">
												<span
													class="text-product block font-medium break-words {hit.checked
														? 'text-muted-foreground line-through'
														: ''}"
												>
													{hit.label}
												</span>
												{#if hit.detail}
													<span class="text-muted-foreground text-caption block break-words">
														{hit.detail}
													</span>
												{/if}
											</span>
											{#if hit.checked}
												<span class="text-muted-foreground shrink-0">
													<Check size={16} aria-hidden="true" />
													<span class="sr-only">{t('search.checked')}</span>
												</span>
											{/if}
										</button>
									</li>
								{/each}
							</ul>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- La fermeture après les résultats : le premier focus doit tomber sur le champ. -->
		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="search-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
