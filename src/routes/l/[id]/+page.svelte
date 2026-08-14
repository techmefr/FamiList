<script lang="ts">
	import { page } from '$app/state';
	import { data } from '$stores/data.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import type { Item } from '$db/schema';
	import ShopSwitcher from '$components/app/ShopSwitcher.svelte';
	import ItemRow from '$components/app/ItemRow.svelte';
	import AddItemForm from '$components/app/AddItemForm.svelte';
	import { createDrag, move } from '$components/app/drag.svelte';
	import { Button } from '$lib/components/ui/button';
	import { ChevronUp, ChevronDown, ArrowLeft, GripVertical } from '@lucide/svelte';

	const listId = $derived(page.params.id!);
	const list = $derived(data.list(listId));
	const groups = $derived(data.groupedItems(listId));

	let priorityOnly = $state(false);
	let hideChecked = $state(false);

	const visible = $derived(
		groups
			.map((group) => ({
				...group,
				items: group.items.filter(
					(item) => (!priorityOnly || item.priority) && (!hideChecked || !item.checked)
				)
			}))
			.filter((group) => group.items.length > 0)
	);

	const total = $derived(data.itemsOf(listId).length);
	const done = $derived(data.itemsOf(listId).filter((i) => i.checked).length);

	/**
	 * L'écran ne montre que les rayons non vides : on réinjecte les rayons masqués à la fin, sinon
	 * réordonner ferait disparaître le parcours appris des rayons momentanément vides.
	 */
	function commitAisleOrder(visibleOrder: string[]) {
		const previous = data.activeLayout?.aisleOrder ?? [];
		const hidden = previous.filter((id) => !visibleOrder.includes(id));
		data.reorderAisles([...visibleOrder, ...hidden]);
	}

	function moveAisle(from: number, to: number) {
		commitAisleOrder(move(visible.map((g) => g.aisleId), from, to));
	}

	function moveItem(aisleId: string, items: Item[], from: number, to: number) {
		if (to < 0 || to >= items.length) return;
		data.reorderItems(aisleId, move(items, from, to));
	}

	const aisleDrag = createDrag(moveAisle);
</script>

<svelte:head>
	<title>{list?.name ?? t('lists.title')} — {t('app.name')}</title>
</svelte:head>

{#if !data.ready}
	<p class="text-muted-foreground">{t('common.loading')}</p>
{:else if !list}
	<p class="text-muted-foreground">{t('list.notFound')}</p>
	<a href="/" class="text-primary mt-4 inline-block underline">{t('list.back')}</a>
{:else}
	<a href="/" class="text-muted-foreground text-label inline-flex items-center gap-2">
		<ArrowLeft size={16} aria-hidden="true" />
		{t('list.back')}
	</a>

	<h1 class="text-h1 mt-2 flex items-center gap-3 font-semibold">
		<span aria-hidden="true">{list.emoji}</span>
		{list.name}
	</h1>
	<p class="text-muted-foreground text-label mt-1">{t('lists.progress', { done, total })}</p>

	<div class="mt-6">
		<ShopSwitcher />
	</div>

	<div class="mt-4 flex flex-wrap items-center gap-2">
		<label class="border-input flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2">
			<input type="checkbox" bind:checked={priorityOnly} data-test="filter-priority" />
			<span class="text-label">{t('list.priorityOnly')}</span>
		</label>
		<label class="border-input flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2">
			<input type="checkbox" bind:checked={hideChecked} data-test="filter-hide-checked" />
			<span class="text-label">{t('list.hideChecked')}</span>
		</label>
		{#if done > 0}
			<Button variant="outline" onclick={() => data.clearChecked(listId)} data-test="clear-checked">
				{t('list.clearChecked', { count: done })}
			</Button>
		{/if}
	</div>

	<AddItemForm {listId} />

	{#if visible.length === 0}
		<p class="text-muted-foreground mt-8">{t('list.empty')}</p>
	{:else}
		<div class="mt-6 space-y-6">
			{#each visible as group, aisleIndex (group.aisleId)}
				{@const aisle = data.aisle(group.aisleId)}
				{@const itemDrag = createDrag((from, to) => moveItem(group.aisleId, group.items, from, to))}
				<section
					data-test="aisle-group"
					data-aisle={group.aisleId}
					{...aisleDrag.handlers(aisleIndex)}
					class={aisleDrag.overIndex === aisleIndex ? 'outline-primary rounded-md outline-2' : ''}
				>
					<div class="mb-2 flex items-center gap-2">
						<GripVertical
							size={18}
							class="text-muted-foreground shrink-0 cursor-grab"
							aria-hidden="true"
						/>
						<h2 class="text-h2 flex flex-1 items-center gap-2 font-medium">
							<span aria-hidden="true">{aisle?.emoji ?? '🛒'}</span>
							{aisle?.name ?? group.aisleId}
						</h2>
						<button
							type="button"
							onclick={() => moveAisle(aisleIndex, aisleIndex - 1)}
							disabled={aisleIndex === 0}
							aria-label={t('list.aisleUp', { name: aisle?.name ?? group.aisleId })}
							data-test="aisle-up"
							class="text-muted-foreground grid size-11 place-items-center disabled:opacity-30"
						>
							<ChevronUp size={18} aria-hidden="true" />
						</button>
						<button
							type="button"
							onclick={() => moveAisle(aisleIndex, aisleIndex + 1)}
							disabled={aisleIndex === visible.length - 1}
							aria-label={t('list.aisleDown', { name: aisle?.name ?? group.aisleId })}
							data-test="aisle-down"
							class="text-muted-foreground grid size-11 place-items-center disabled:opacity-30"
						>
							<ChevronDown size={18} aria-hidden="true" />
						</button>
					</div>

					<div class="space-y-2">
						{#each group.items as item, index (item.id)}
							<div
								{...itemDrag.handlers(index)}
								class={itemDrag.overIndex === index ? 'outline-primary rounded-md outline-2' : ''}
							>
								<ItemRow
									{item}
									canMoveUp={index > 0}
									canMoveDown={index < group.items.length - 1}
									onMoveUp={() => moveItem(group.aisleId, group.items, index, index - 1)}
									onMoveDown={() => moveItem(group.aisleId, group.items, index, index + 1)}
								/>
							</div>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
{/if}
