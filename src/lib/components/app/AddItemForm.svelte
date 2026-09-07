<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { DEFAULT_UNIT, UNITS } from '$domain/units';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Plus } from '@lucide/svelte';

	let { listId }: { listId: string } = $props();

	let name = $state('');
	let qty = $state('1');
	let unit = $state<string>(DEFAULT_UNIT);
	let aisleId = $state('');

	/** Le rayon deviné suit la saisie tant que l'utilisateur n'en a pas choisi un lui-même. */
	const suggested = $derived(name.trim() ? data.suggestAisleId(name) : '');
	const effectiveAisle = $derived(aisleId || suggested);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim()) return;

		feedback.play('add');
		data.addItem(listId, { name, qty, unit, aisleId: effectiveAisle });
		name = '';
		qty = '1';
		unit = DEFAULT_UNIT;
		aisleId = '';
	}
</script>

<form onsubmit={submit} class="bg-card mt-6 space-y-3 rounded-md border p-4" data-test="add-item">
	<!--
		Les largeurs ne s'appliquent qu'à partir de sm : en dessous, chaque champ prend la ligne
		entière. Une largeur en rem se multiplie par le cran de texte, et un w-32 devient 294 px au
		cran Confort — de quoi déborder un téléphone.
	-->
	<div class="grid gap-3 sm:grid-cols-[2fr_auto_auto]">
		<div class="min-w-0">
			<Label for="item-name">{t('add.name')}</Label>
			<Input id="item-name" bind:value={name} data-test="add-name" required />
		</div>
		<div class="sm:w-24">
			<Label for="item-qty">{t('add.qty')}</Label>
			<Input id="item-qty" bind:value={qty} data-test="add-qty" inputmode="decimal" />
		</div>
		<div class="min-w-0">
			<Label for="item-unit">{t('add.unit')}</Label>
			<select
				id="item-unit"
				bind:value={unit}
				data-test="add-unit"
				class="border-input bg-background min-h-[max(2.75rem,44px)] w-full rounded-md border px-3 py-1"
			>
				{#each UNITS as id (id)}
					<option value={id}>{t(`units.${id}`)}</option>
				{/each}
			</select>
		</div>
	</div>

	<div>
		<Label for="item-aisle">{t('add.aisle')}</Label>
		<select
			id="item-aisle"
			bind:value={aisleId}
			data-test="add-aisle"
			class="border-input bg-background min-h-[max(2.75rem,44px)] w-full rounded-md border px-3 py-1"
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

	<Button type="submit" data-test="add-submit" class="fl-press w-full sm:w-auto">
		<Plus size={18} aria-hidden="true" />
		{t('add.submit')}
	</Button>
</form>
