<script lang="ts">
	import type { LoyaltyCard } from '$db/schema';
	import { isMatrixFormat } from '$domain/code-format';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { QrCode, Barcode, StickyNote } from '@lucide/svelte';

	let { card }: { card: LoyaltyCard } = $props();
</script>

<article
	class="relative min-h-[7.5rem] overflow-hidden rounded-lg p-5 text-white shadow-[var(--fl-shadow-2)]"
	style="background: {card.grad || card.tint}"
	data-test="loyalty-card"
>
	<span
		class="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full border border-white/20"
		aria-hidden="true"
	></span>
	<span
		class="pointer-events-none absolute -right-5 -bottom-16 size-36 rounded-full border border-white/10"
		aria-hidden="true"
	></span>

	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			<p class="text-caption font-medium tracking-wide opacity-75">{t('cards.loyalty')}</p>
			<h2 class="text-product mt-1 font-semibold">{card.name}</h2>
		</div>

		<div class="flex shrink-0 items-center gap-2">
			{#if card.notes}
				<span class="grid size-7 place-items-center rounded-md bg-white/20" aria-hidden="true">
					<StickyNote size={14} />
				</span>
			{/if}
			<span class="grid size-9 place-items-center rounded-md bg-white" aria-hidden="true">
				{#if isMatrixFormat(card.codeType)}
					<QrCode size={20} color="#111" />
				{:else}
					<Barcode size={20} color="#111" />
				{/if}
			</span>
		</div>
	</div>

	<div class="mt-5 flex items-end justify-between gap-3">
		<p class="text-label font-mono tracking-widest opacity-85">{card.num}</p>
		<div class="text-end">
			<p class="text-caption font-medium opacity-70">{t('cards.points')}</p>
			<p class="text-h2 leading-none font-semibold">{i18n.number(card.points)}</p>
		</div>
	</div>
</article>
