<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { guessAisle } from '$domain/guess-aisle';
	import { t } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Plus } from '@lucide/svelte';

	let { listId }: { listId: string } = $props();

	let name = $state('');
	let qty = $state('1');
	let unit = $state('pièce');
	let aisleId = $state('');

	/** Le rayon deviné suit la saisie tant que l'utilisateur n'en a pas choisi un lui-même. */
	const suggested = $derived(name.trim() ? guessAisle(name) : '');
	const effectiveAisle = $derived(aisleId || suggested);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim()) return;

		data.addItem(listId, { name, qty, unit, aisleId: effectiveAisle });
		name = '';
		qty = '1';
		unit = 'pièce';
		aisleId = '';
	}
</script>

<form onsubmit={submit} class="bg-card mt-6 space-y-3 rounded-md border p-4" data-test="add-item">
	<div class="grid gap-3 sm:grid-cols-[2fr_auto_auto]">
		<div>
			<Label for="item-name">{t('add.name')}</Label>
			<Input id="item-name" bind:value={name} data-test="add-name" required />
		</div>
		<div class="w-24">
			<Label for="item-qty">{t('add.qty')}</Label>
			<Input id="item-qty" bind:value={qty} data-test="add-qty" inputmode="decimal" />
		</div>
		<div class="w-32">
			<Label for="item-unit">{t('add.unit')}</Label>
			<Input id="item-unit" bind:value={unit} data-test="add-unit" />
		</div>
	</div>

	<div>
		<Label for="item-aisle">{t('add.aisle')}</Label>
		<select
			id="item-aisle"
			bind:value={aisleId}
			data-test="add-aisle"
			class="border-input bg-background w-full rounded-md border px-3"
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
	</div>

	<Button type="submit" data-test="add-submit" class="w-full sm:w-auto">
		<Plus size={18} aria-hidden="true" />
		{t('add.submit')}
	</Button>
</form>
