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

	const panneau = $derived(`aisle-panel-${rank}`);
	const pourcent = $derived(total ? Math.round((done / total) * 100) : 0);
</script>

<!--
	Un rayon, sa carte, et de quoi la replier.

	Replier n'est pas de la décoration : on ne fait pas toutes ses courses dans le même magasin. La
	viande ici, le reste ailleurs — dans ce cas on veut ouvrir un rayon, l'ordonner, et que les huit
	autres cessent d'occuper l'écran. Déplié, un rayon de dix articles remplit deux hauteurs de
	téléphone à lui seul.

	Le trait sous l'en-tête sépare ce qui décrit le rayon de ce qu'il contient. Sans lui, la carte
	n'est qu'une colonne d'éléments de même poids et le titre se perd dans ses propres articles.
-->
<section class="bg-card shadow-fl-1 overflow-hidden rounded-xl border" data-test-class="aisle-group">
	<div class="flex items-stretch">
		<!--
			La poignée double les flèches, elle ne les remplace pas. Elle n'est ni focalisable ni
			annoncée : son unique fonction est déjà offerte par deux boutons étiquetés juste à côté,
			et un élément qu'on peut atteindre au clavier sans pouvoir s'en servir est un piège.
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
			aria-controls={panneau}
			data-test-class="aisle-toggle"
			class="flex min-w-0 flex-1 items-center gap-3 py-3 pe-2 ps-1 text-start"
		>
			<span class="bg-muted relative grid size-11 shrink-0 place-items-center rounded-md text-xl">
				<span aria-hidden="true">{emoji}</span>
				<!-- Le rang dit l'ordre du parcours : sans lui, « appris » reste une affirmation. -->
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
						<span class="bg-secondary block h-full rounded-full" style="width: {pourcent}%"></span>
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
			id={panneau}
			transition:slide={{ duration: motionMs(260), easing: cubicOut }}
			class="space-y-2 border-t p-2"
		>
			{@render children()}
		</div>
	{/if}
</section>
