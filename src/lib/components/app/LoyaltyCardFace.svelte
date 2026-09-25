<script lang="ts">
	import type { LoyaltyCard } from '$db/schema';
	import { isMatrixFormat } from '$domain/code-format';
	import { cardBackground } from '$domain/tint';
	import { t } from '$i18n/index.svelte';
	import BrandMark from './BrandMark.svelte';
	import { QrCode, Barcode, StickyNote } from '@lucide/svelte';

	/**
	 * `actions` keeps the bottom of the card free for the edit and delete buttons laid over it: in a
	 * half-width card, the number would otherwise run under them.
	 */
	let {
		card,
		actions = false
	}: {
		card: Pick<LoyaltyCard, 'name' | 'brand' | 'num' | 'tint' | 'codeType' | 'notes'>;
		actions?: boolean;
	} = $props();
</script>

<article
	class="relative flex h-full min-h-[7.5rem] flex-col overflow-hidden rounded-lg p-4 text-white shadow-[var(--fl-shadow-2)] {actions
		? 'pb-14'
		: ''}"
	style="background: {cardBackground(card.tint)}"
	data-test-class="loyalty-card"
	data-tint={card.tint}
>
	<span
		class="pointer-events-none absolute -top-10 -end-10 size-40 rounded-full border border-white/20"
		aria-hidden="true"
	></span>

	<div class="flex items-start justify-between gap-2">
		<BrandMark name={card.name} brand={card.brand} tint={card.tint} />

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

	<p class="text-caption mt-3 font-medium tracking-wide">{t('cards.loyalty')}</p>
	<h2 class="text-product font-semibold hyphens-auto wrap-anywhere">{card.name}</h2>
	<p class="text-label mt-auto pt-2 font-mono tracking-widest break-all"><span dir="ltr">{card.num}</span></p>
</article>
