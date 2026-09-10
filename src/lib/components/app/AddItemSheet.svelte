<script lang="ts">
	import { tick } from 'svelte';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { settings } from '$stores/settings.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import type { Item } from '$db/schema';
	import {
		DEFAULT_UNIT_GROUP,
		UNIT_GROUPS,
		unitGroupOf,
		unitsOf,
		type UnitGroupId,
		type UnitId
	} from '$domain/units';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Plus, ShoppingBasket, Hash, LayoutList, X, StickyNote, Check } from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';

	let { listId }: { listId: string } = $props();

	let dialog = $state<HTMLDialogElement | null>(null);
	let field = $state<HTMLInputElement | null>(null);

	let name = $state('');
	let qty = $state('1');
	let group = $state<UnitGroupId>(DEFAULT_UNIT_GROUP);
	let unit = $state<UnitId>(unitsOf(DEFAULT_UNIT_GROUP)[0]);
	let aisleId = $state('');
	let note = $state('');

	/** L'article en cours de modification, ou rien du tout quand on en ajoute un. */
	let edite = $state<Item | null>(null);

	/**
	 * Même contrat que les autres feuilles : `showModal()` et rien d'autre, jamais de booléen en
	 * parallèle. Échap ferme sans passer par nous, et un miroir de l'état finit toujours par mentir.
	 *
	 * Le focus après `await tick()` : `showModal()` place lui-même le focus sur le premier élément
	 * atteignable, et le déplacer avant qu'il ait fini revient à le lui rendre aussitôt.
	 *
	 * Puis une seconde fois, un peu plus tard. La feuille s'ouvre au bout d'une navigation, et
	 * SvelteKit remet le focus sur le corps du document une fois celle-ci terminée, pour annoncer
	 * la nouvelle page : sans ce rattrapage, le curseur atterrissait nulle part. La reprise ne se
	 * fait que si personne n'a bougé entre-temps — on ne vole pas le focus de quelqu'un qui a déjà
	 * tabulé ailleurs.
	 */
	export async function show(item?: Item) {
		edite = item ?? null;

		if (item) {
			name = item.name;
			qty = item.qty;
			aisleId = item.aisleId;
			note = item.note ?? '';
			// La famille se déduit de l'unité enregistrée : l'écran s'ouvre sur la rangée où se
			// trouve cette unité, pas sur celle de départ.
			group = unitGroupOf(item.unit);
			unit = unitsOf(group).find((id) => id === item.unit) ?? unitsOf(group)[0];
		} else {
			reset();
		}

		dialog?.showModal();
		await tick();
		field?.focus();

		setTimeout(() => {
			const perdu = document.activeElement === document.body || document.activeElement === dialog;
			if (dialog?.open && perdu) field?.focus();
		}, 80);
	}

	function hide() {
		dialog?.close();
	}

	/** Le rayon deviné suit la saisie tant que personne n'en a choisi un. */
	const suggested = $derived(name.trim() ? data.suggestAisleId(name) : '');
	const effectiveAisle = $derived(aisleId || suggested);

	const choices = $derived(unitsOf(group));

	/**
	 * Changer de famille change l'unité : rester sur « kg » après être passé aux liquides
	 * enregistrerait une unité qui n'est plus proposée à l'écran.
	 */
	function chooseGroup(id: UnitGroupId) {
		group = id;
		unit = unitsOf(id)[0];
	}

	function reset() {
		name = '';
		qty = '1';
		chooseGroup(DEFAULT_UNIT_GROUP);
		aisleId = '';
		note = '';
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim()) return;

		if (edite) {
			feedback.play('success');
			data.updateItem(edite.id, { name, qty, unit, aisleId: effectiveAisle, note });
		} else {
			feedback.play('add');
			data.addItem(listId, { name, qty, unit, aisleId: effectiveAisle, note });
		}

		edite = null;
		reset();
		hide();
	}
</script>

<!--
	L'ajout d'un article est passé de la carte posée sous la liste à cette feuille, ouverte par le
	bouton de création. La carte occupait le bas de chaque liste en permanence, pour un geste qui
	n'arrive qu'entre deux courses : on lisait sa liste avec un formulaire vide sous les yeux.

	Le voile, l'enfermement du clavier, l'inertie du reste de la page et la fermeture sur Échap
	viennent du `<dialog>` natif. Ce sont les quatre comportements qu'une <div> obligerait à
	réécrire, et à rater.
-->
<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="add-title"
	data-test-id="add-item"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="add-title" class="text-h2 pe-12 font-semibold">
			{edite ? t('add.editTitle') : t('create.item')}
		</h2>

		<form onsubmit={submit} class="mt-4 space-y-5">
			<div>
				<Label for="item-name">{t('add.name')}</Label>
				<IconField icon={ShoppingBasket}>
					<Input
						id="item-name"
						bind:ref={field}
						bind:value={name}
						data-test-id="add-name"
						required
						placeholder={t('add.namePlaceholder')}
					/>
				</IconField>
			</div>

			<!--
				L'unité se choisit avant la quantité, et en deux temps. « Combien ? » n'a pas de sens
				tant qu'on ne sait pas de quoi on compte : trois cents, c'est trois cents grammes ou
				trois cents pièces. Quinze unités dans une liste déroulante demandaient de lire quinze
				mots pour en garder un ; par famille, c'est deux choix la plupart du temps.
			-->
			<fieldset>
				<legend class="text-label font-medium">{t('add.unitKind')}</legend>
				<div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
					{#each UNIT_GROUPS as candidate (candidate.id)}
						<Label class="fl-choice">
							<input
								type="radio"
								name="unit-group"
								class="sr-only"
								checked={group === candidate.id}
								onchange={() => chooseGroup(candidate.id)}
								data-test-id="add-unit-group-{candidate.id}"
							/>
							{t(`unitGroup.${candidate.id}`)}
						</Label>
					{/each}
				</div>
			</fieldset>

			<!-- Une famille à une seule unité ne demande pas de deuxième choix : « Pièces » puis
				« pièce » serait un pas pour rien. -->
			{#if choices.length > 1}
				<fieldset data-test-id="add-unit">
					<legend class="text-label font-medium">{t('add.unit')}</legend>
					<div class="mt-2 flex flex-wrap gap-2">
						{#each choices as id (id)}
							<Label class="fl-choice">
								<input
									type="radio"
									name="unit"
									class="sr-only"
									checked={unit === id}
									onchange={() => (unit = id)}
									data-test-id="add-unit-{id}"
								/>
								{t(`units.${id}`)}
							</Label>
						{/each}
					</div>
				</fieldset>
			{/if}

			<!--
				L'unité choisie est rappelée dans le libellé. Sans elle, « 500 » ne dit plus rien une
				fois la rangée de pastilles sortie du champ de vision — ce qui arrive dès que le
				clavier logiciel s'ouvre. Dans le libellé et pas au bout du champ : « bouteille » y
				passerait par-dessus la saisie, et un retrait taillé pour le mot le plus long
				laisserait un trou béant pour « g ».
			-->
			<div>
				<Label for="item-qty" data-test-id="add-qty-label">
					{t('add.qty')} ({t(`units.${unit}`)})
				</Label>
				<IconField icon={Hash}>
					<Input
						id="item-qty"
						bind:value={qty}
						data-test-id="add-qty"
						inputmode="decimal"
						placeholder={t('add.qtyPlaceholder')}
					/>
				</IconField>
			</div>

			<div>
				<Label for="item-aisle">{t('add.aisle')}</Label>
				<IconField icon={LayoutList}>
					<select
						id="item-aisle"
						bind:value={aisleId}
						data-test-id="add-aisle"
						class="border-input bg-background min-h-[max(2.75rem,44px)] w-full rounded-md border"
					>
						<option value="">
							{suggested
								? t('add.aisleGuessed', { name: data.aisle(suggested)?.name ?? suggested })
								: t('add.aisleAuto')}
						</option>
						{#each data.aisles as aisle (aisle.id)}
							<option value={aisle.id}>{aisle.emoji} {aisle.name}</option>
						{/each}
					</select>
				</IconField>
			</div>

			<!--
				La note existait en base et s'affichait déjà sous l'article, sans qu'aucun écran ne
				permette de l'écrire. C'est là qu'elle se remplit : « la grande bouteille », « sans
				sucre », ce qu'on dirait à voix haute à qui fait les courses à sa place.
			-->
			<div>
				<Label for="item-note">{t('add.note')}</Label>
				<IconField icon={StickyNote}>
					<Input
						id="item-note"
						bind:value={note}
						data-test-id="add-note"
						maxlength={120}
						placeholder={t('add.notePlaceholder')}
					/>
				</IconField>
			</div>

			<div class="flex flex-wrap justify-end gap-2">
				<Button type="button" variant="outline" onclick={hide} class="fl-press">
					{t('common.cancel')}
				</Button>
				<Button type="submit" data-test-id="add-submit" class="fl-press">
					{#if edite}
						<Check size={18} aria-hidden="true" />
						{t('add.saveEdit')}
					{:else}
						<Plus size={18} aria-hidden="true" />
						{t('add.submit')}
					{/if}
				</Button>
			</div>
		</form>

		<!--
			La fermeture vient après le formulaire dans le document, même si elle s'affiche en haut à
			droite : le navigateur donne le premier focus au premier élément atteignable, et mieux vaut
			que ce soit le champ que la sortie.
		-->
		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="add-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
