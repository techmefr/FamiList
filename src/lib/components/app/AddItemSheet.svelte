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

	/** The item being edited, or nothing at all when adding one. */
	let editing = $state<Item | null>(null);

	/**
	 * Same contract as the other sheets: `showModal()` and nothing else, never a boolean alongside. Escape
	 * closes without going through us, and a mirror of the state always ends up lying.
	 *
	 * Focus after `await tick()`: `showModal()` places focus on the first reachable element itself, and
	 * moving it before it has finished amounts to handing it straight back.
	 *
	 * Then a second time, a little later. The sheet opens at the end of a navigation, and SvelteKit puts
	 * focus back on the document body once that is done, to announce the new page: without this catch-up,
	 * the cursor landed nowhere. The retry only happens if nobody moved in the meantime — we do not steal
	 * focus from somebody who has already tabbed elsewhere.
	 */
	export async function show(item?: Item) {
		editing = item ?? null;

		if (item) {
			name = item.name;
			qty = item.qty;
			aisleId = item.aisleId;
			note = item.note ?? '';
			// The family is derived from the saved unit: the screen opens on the row where that unit is, not on the
			// starting one.
			group = unitGroupOf(item.unit);
			unit = unitsOf(group).find((id) => id === item.unit) ?? unitsOf(group)[0];
		} else {
			reset();
		}

		dialog?.showModal();
		await tick();
		field?.focus();

		setTimeout(() => {
			const lost = document.activeElement === document.body || document.activeElement === dialog;
			if (dialog?.open && lost) field?.focus();
		}, 80);
	}

	function hide() {
		dialog?.close();
	}

	/** The guessed aisle follows what is typed until somebody chooses one. */
	const suggested = $derived(name.trim() ? data.suggestAisleId(name) : '');
	const effectiveAisle = $derived(aisleId || suggested);

	const choices = $derived(unitsOf(group));

	/**
	 * Changing family changes the unit: staying on "kg" after moving to liquids would save a unit no longer
	 * offered on screen.
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

		if (editing) {
			feedback.play('success');
			data.updateItem(editing.id, { name, qty, unit, aisleId: effectiveAisle, note });
		} else {
			feedback.play('add');
			data.addItem(listId, { name, qty, unit, aisleId: effectiveAisle, note });
		}

		editing = null;
		reset();
		hide();
	}
</script>

<!--
	Adding an item moved from the card sitting under the list to this sheet, opened by the create button. The
	card took up the bottom of every list permanently, for a gesture that only happens between two shopping
	trips: you read your list with an empty form in front of you.

	The scrim, the keyboard trapping, the inertness of the rest of the page and closing on Escape come from
	the native `<dialog>`. Those are the four behaviours a <div> would force us to rewrite, and to get wrong.
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
			{editing ? t('add.editTitle') : t('create.item')}
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
				The unit is chosen before the quantity, and in two steps. "How many?" means nothing until you know
				what is being counted: three hundred is three hundred grams or three hundred pieces. Fifteen units in
				a dropdown meant reading fifteen words to keep one; by family, it is two choices most of the time.
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

			<!-- A family with a single unit does not ask for a second choice: "Pieces" then "piece" would be a step
				for nothing. -->
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
				The chosen unit is repeated in the label. Without it, "500" says nothing once the row of badges has
				left the field of view — which happens as soon as the software keyboard opens. In the label and not at
				the end of the field: "bottle" would sit over what is being typed there, and padding cut for the
				longest word would leave a gaping hole for "g".
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
				The note existed in the database and was already shown under the item, without any screen allowing it
				to be written. This is where it gets filled in: "the big bottle", "sugar free", what you would say out
				loud to whoever is shopping for you.
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
					{#if editing}
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
			The close button comes after the form in the document, even though it shows at the top right: the
			browser gives first focus to the first reachable element, and better that it is the field than the way
			out.
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
