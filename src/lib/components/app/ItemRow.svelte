<script lang="ts">
	import type { Item } from '$db/schema';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { unitKey } from '$domain/units';
	import { Star, Trash2, ArrowUp, ArrowDown, GripVertical } from '@lucide/svelte';

	let {
		item,
		grip,
		onMoveUp,
		onMoveDown,
		canMoveUp,
		canMoveDown
	}: {
		item: Item;
		grip: Record<string, unknown>;
		onMoveUp: () => void;
		onMoveDown: () => void;
		canMoveUp: boolean;
		canMoveDown: boolean;
	} = $props();

	const inputId = $derived(`item-${item.id}`);

	/**
	 * Une unité inconnue s'affiche telle qu'elle a été écrite : un article saisi « douzaine » avant
	 * que le champ devienne une liste doit rester lisible, pas être remplacé par une unité voisine.
	 */
	const unitLabel = $derived.by(() => {
		const key = unitKey(item.unit);
		return key ? t(key) : item.unit;
	});

	/** `item.checked` est encore l'état d'avant : cocher monte, décocher descend. */
	function toggle() {
		feedback.play(item.checked ? 'uncheck' : 'check');
		data.toggleItem(item.id);
	}
</script>

<div
	class="bg-card flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 transition-colors"
	data-test-class="item-row"
>
	<!--
		La poignée. Elle double les flèches sans les remplacer : celles-ci restent le chemin du
		clavier, elle est le geste du pouce. Ni focalisable ni annoncée, pour la même raison —
		atteindre au clavier une poignée dont on ne peut rien faire au clavier serait un piège.
	-->
	<span
		{...grip}
		data-test-class="item-grip"
		aria-hidden="true"
		class="fl-reorder-grip text-muted-foreground -my-2 flex shrink-0 items-center self-stretch pe-1"
	>
		<GripVertical size={18} />
	</span>

	<!--
		La case est dans l'étiquette, pas à côté : seule, elle offrait une cible de 28 px là où il en
		faut 44. Englobée, c'est toute la ligne de texte qui coche, et la cible dépasse largement.
	-->
	<label
		for={inputId}
		class="flex min-h-[max(2.75rem,44px)] min-w-0 flex-1 basis-[12rem] cursor-pointer items-center gap-3 py-1"
	>
		<input
			id={inputId}
			type="checkbox"
			checked={item.checked}
			onchange={toggle}
			data-test-class="item-check"
			class="accent-primary shrink-0"
		/>

		<span class="min-w-0">
			<span
				class="text-product block transition-colors {item.checked
					? 'text-muted-foreground line-through'
					: ''}"
			>
				{item.name}
			</span>
			<span class="text-muted-foreground text-caption">
				{item.qty}
				{unitLabel}{item.note ? ` — ${item.note}` : ''}
			</span>
		</span>
	</label>

	<div class="flex max-w-full shrink-0 flex-wrap items-center justify-end">
		<button
			type="button"
			onclick={onMoveUp}
			disabled={!canMoveUp}
			aria-label={t('list.moveUp', { name: item.name })}
			data-test-class="item-up"
			class="fl-press text-muted-foreground grid size-11 min-w-[44px] place-items-center disabled:opacity-30"
		>
			<ArrowUp size={18} aria-hidden="true" />
		</button>
		<button
			type="button"
			onclick={onMoveDown}
			disabled={!canMoveDown}
			aria-label={t('list.moveDown', { name: item.name })}
			data-test-class="item-down"
			class="fl-press text-muted-foreground grid size-11 min-w-[44px] place-items-center disabled:opacity-30"
		>
			<ArrowDown size={18} aria-hidden="true" />
		</button>
		<button
			type="button"
			onclick={() => {
				feedback.play('tap');
				data.togglePriority(item.id);
			}}
			aria-label={t('list.priority', { name: item.name })}
			aria-pressed={item.priority}
			data-test-class="item-priority"
			class="fl-press grid size-11 min-w-[44px] place-items-center {item.priority
				? 'text-primary'
				: 'text-muted-foreground'}"
		>
			<Star size={18} fill={item.priority ? 'currentColor' : 'none'} aria-hidden="true" />
		</button>
		<button
			type="button"
			onclick={() => {
				feedback.play('remove');
				data.removeItem(item.id);
			}}
			aria-label={t('list.remove', { name: item.name })}
			data-test-class="item-remove"
			class="fl-press text-muted-foreground grid size-11 min-w-[44px] place-items-center"
		>
			<Trash2 size={18} aria-hidden="true" />
		</button>
	</div>
</div>
