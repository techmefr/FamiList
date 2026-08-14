<script lang="ts">
	import type { Item } from '$db/schema';
	import { data } from '$stores/data.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { Star, Trash2, ChevronUp, ChevronDown, GripVertical } from '@lucide/svelte';

	let {
		item,
		onMoveUp,
		onMoveDown,
		canMoveUp,
		canMoveDown
	}: {
		item: Item;
		onMoveUp: () => void;
		onMoveDown: () => void;
		canMoveUp: boolean;
		canMoveDown: boolean;
	} = $props();

	const inputId = $derived(`item-${item.id}`);
</script>

<div class="bg-card flex items-center gap-3 rounded-md border px-3 py-2" data-test="item-row">
	<GripVertical
		size={18}
		class="text-muted-foreground shrink-0 cursor-grab"
		aria-hidden="true"
	/>

	<input
		id={inputId}
		type="checkbox"
		checked={item.checked}
		onchange={() => data.toggleItem(item.id)}
		data-test="item-check"
		class="accent-primary shrink-0"
	/>

	<label for={inputId} class="min-w-0 flex-1 cursor-pointer py-1">
		<span class="text-product block {item.checked ? 'text-muted-foreground line-through' : ''}">
			{item.name}
		</span>
		<span class="text-muted-foreground text-caption">
			{item.qty}
			{item.unit}{item.note ? ` — ${item.note}` : ''}
		</span>
	</label>

	<div class="flex shrink-0 items-center">
		<button
			type="button"
			onclick={onMoveUp}
			disabled={!canMoveUp}
			aria-label={t('list.moveUp', { name: item.name })}
			data-test="item-up"
			class="text-muted-foreground grid size-11 place-items-center disabled:opacity-30"
		>
			<ChevronUp size={18} aria-hidden="true" />
		</button>
		<button
			type="button"
			onclick={onMoveDown}
			disabled={!canMoveDown}
			aria-label={t('list.moveDown', { name: item.name })}
			data-test="item-down"
			class="text-muted-foreground grid size-11 place-items-center disabled:opacity-30"
		>
			<ChevronDown size={18} aria-hidden="true" />
		</button>
		<button
			type="button"
			onclick={() => data.togglePriority(item.id)}
			aria-label={t('list.priority', { name: item.name })}
			aria-pressed={item.priority}
			data-test="item-priority"
			class="grid size-11 place-items-center {item.priority
				? 'text-primary'
				: 'text-muted-foreground'}"
		>
			<Star size={18} fill={item.priority ? 'currentColor' : 'none'} aria-hidden="true" />
		</button>
		<button
			type="button"
			onclick={() => data.removeItem(item.id)}
			aria-label={t('list.remove', { name: item.name })}
			data-test="item-remove"
			class="text-muted-foreground grid size-11 place-items-center"
		>
			<Trash2 size={18} aria-hidden="true" />
		</button>
	</div>
</div>
