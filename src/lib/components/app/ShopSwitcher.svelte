<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { t } from '$i18n/index.svelte';
	import { tintForWhiteText } from '$domain/tint';
	import ShopPicker from '$components/app/ShopPicker.svelte';
	import { ChevronDown, Route } from '@lucide/svelte';

	let { compact = false }: { compact?: boolean } = $props();

	let picker = $state<ShopPicker | null>(null);

	const shop = $derived(data.activeShop);
	const learned = $derived(data.layouts.find((l) => l.shopId === shop?.id)?.learned ?? false);
</script>

<!--
	The active shop, and a way to change it.

	A bar and not a row of chips: at five or six shops, the chips overflowed the screen and had to be scrolled
	to see which was chosen. Here the active shop is always read in full, and the complete list lives in a
	sheet — which is also where there is room to show the address, which is what tells two shops of the same
	brand apart.

	"Learned route" is written on the bar: it is what explains why the aisles are in that order, and the
	information is only of interest for the shop being read.
-->
{#if !shop}
	<p class="text-muted-foreground text-label">
		<a href="/shops" class="text-primary inline-flex min-h-[max(2.75rem,44px)] items-center underline">
			{t('list.noShop')}
		</a>
	</p>
{:else if compact}
	<!--
		The thumb's shape: what is left when there is only the width of a bar. The three-letter code and the name
		are enough to know where you are; the address and the learned route wait in the sheet.
	-->
	<button
		type="button"
		onclick={() => picker?.show()}
		aria-haspopup="dialog"
		data-test-id="shop-bar-compact"
		class="fl-press flex min-h-[max(2.75rem,44px)] min-w-0 flex-1 items-center gap-2 rounded-full px-1 text-start"
	>
		<span
			class="text-caption grid size-9 shrink-0 place-items-center rounded-full font-semibold text-white"
			style="background: {tintForWhiteText(shop.tint)}"
			aria-hidden="true"
		>
			{shop.short}
		</span>

		<span class="text-label min-w-0 flex-1 truncate font-medium">
			<span class="sr-only">{t('list.shop')} : </span>{shop.name}
		</span>

		{#if learned}
			<Route size={14} class="text-secondary shrink-0" aria-hidden="true" />
		{/if}
		<ChevronDown size={18} class="text-muted-foreground shrink-0" aria-hidden="true" />
	</button>

	<ShopPicker bind:this={picker} />
{:else}
	<button
		type="button"
		onclick={() => picker?.show()}
		aria-haspopup="dialog"
		data-test-id="shop-bar"
		class="bg-card border-input shadow-fl-2 flex w-full items-center gap-3 rounded-lg border p-3 text-start"
	>
		<span
			class="text-label grid size-11 shrink-0 place-items-center rounded-md font-semibold text-white"
			style="background: {tintForWhiteText(shop.tint)}"
			aria-hidden="true"
		>
			{shop.short}
		</span>

		<span class="min-w-0 flex-1">
			<span class="text-caption text-muted-foreground flex flex-wrap items-center gap-x-2">
				{t('list.shop')}
				{#if learned}
					<span class="text-secondary inline-flex items-center gap-1 font-semibold">
						<Route size={12} aria-hidden="true" />
						{t('list.learnedShop')}
					</span>
				{/if}
			</span>
			<span class="text-product block font-medium break-words">{shop.name}</span>
		</span>

		<ChevronDown size={20} class="text-muted-foreground shrink-0" aria-hidden="true" />
	</button>

	<ShopPicker bind:this={picker} />
{/if}
