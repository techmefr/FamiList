<script lang="ts">
	import type { Snippet } from 'svelte';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { motionMs } from '$stores/settings.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { ArrowDown, ArrowUp, ChevronDown, GripVertical } from '@lucide/svelte';

	let {
		name,
		emoji,
		rank,
		done,
		total,
		open,
		grip,
		onToggle,
		onMoveUp,
		onMoveDown,
		canMoveUp,
		canMoveDown,
		children
	}: {
		name: string;
		emoji: string;
		rank: number;
		done: number;
		total: number;
		open: boolean;
		grip: Record<string, unknown>;
		onToggle: () => void;
		onMoveUp: () => void;
		onMoveDown: () => void;
		canMoveUp: boolean;
		canMoveDown: boolean;
		children: Snippet;
	} = $props();

	const panel = $derived(`aisle-panel-${rank}`);
	const percent = $derived(total ? Math.round((done / total) * 100) : 0);
</script>

<!--
	An aisle, its card, and a way to fold it.

	Folding is not decoration: you do not do all your shopping in the same shop. The meat here, the rest
	elsewhere — in that case you want to open one aisle, order it, and have the other eight stop taking up the
	screen. Unfolded, an aisle of ten items fills two phone heights on its own.

	The rule under the header separates what describes the aisle from what it contains. Without it, the card
	is only a column of items of the same weight and the title gets lost among its own items.
-->
<section class="bg-card shadow-fl-1 overflow-hidden rounded-xl border" data-test-class="aisle-group">
	<div class="flex items-stretch">
		<!--
			The handle doubles the arrows, it does not replace them. It is neither focusable nor announced: its only
			function is already offered by two labelled buttons right beside it, and an element you can reach by
			keyboard without being able to use it is a trap.
		-->
		<span
			{...grip}
			data-test-class="aisle-grip"
			aria-hidden="true"
			class="fl-reorder-grip text-muted-foreground flex items-center ps-3 pe-1"
		>
			<GripVertical size={20} />
		</span>

		<button
			type="button"
			onclick={onToggle}
			aria-expanded={open}
			aria-controls={panel}
			data-test-class="aisle-toggle"
			class="flex min-w-0 flex-1 items-center gap-3 py-3 pe-2 ps-1 text-start"
		>
			<span class="bg-muted relative grid size-11 shrink-0 place-items-center rounded-md text-xl">
				<span aria-hidden="true">{emoji}</span>
				<!-- The rank says the order of the route: without it, "learned" stays an assertion. -->
				<span
					class="bg-foreground text-background text-caption absolute -start-1.5 -top-1.5 grid size-5 place-items-center rounded-full font-semibold"
					aria-hidden="true"
				>
					{rank + 1}
				</span>
			</span>

			<span class="min-w-0 flex-1">
				<span class="text-label block font-medium break-words">{name}</span>
				<span class="mt-1 flex items-center gap-2">
					<span class="bg-muted h-1 w-full max-w-24 overflow-hidden rounded-full" aria-hidden="true">
						<span class="bg-secondary block h-full rounded-full" style="width: {percent}%"></span>
					</span>
					<span class="text-muted-foreground text-caption tabular-nums">{done}/{total}</span>
				</span>
			</span>

			<ChevronDown
				size={22}
				class="text-muted-foreground shrink-0 transition-transform {open ? '' : '-rotate-90 rtl:rotate-90'}"
				aria-hidden="true"
			/>
		</button>

		<div class="flex items-center">
			<button
				type="button"
				onclick={onMoveUp}
				disabled={!canMoveUp}
				aria-label={t('list.aisleUp', { name })}
				data-test-class="aisle-up"
				class="fl-press text-muted-foreground grid size-11 min-w-[44px] place-items-center disabled:opacity-30"
			>
				<ArrowUp size={18} aria-hidden="true" />
			</button>
			<button
				type="button"
				onclick={onMoveDown}
				disabled={!canMoveDown}
				aria-label={t('list.aisleDown', { name })}
				data-test-class="aisle-down"
				class="fl-press text-muted-foreground grid size-11 min-w-[44px] place-items-center disabled:opacity-30"
			>
				<ArrowDown size={18} aria-hidden="true" />
			</button>
		</div>
	</div>

	{#if open}
		<div
			id={panel}
			transition:slide={{ duration: motionMs(260), easing: cubicOut }}
			class="space-y-2 border-t p-2"
		>
			{@render children()}
		</div>
	{/if}
</section>
