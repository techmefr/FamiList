<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { Check } from '@lucide/svelte';
</script>

<fieldset>
	<legend class="text-label text-muted-foreground mb-2">{t('list.shop')}</legend>

	<div class="flex gap-2 overflow-x-auto pb-1">
		{#each data.shops as shop (shop.id)}
			{@const active = data.activeShopId === shop.id}
			{@const learned = data.layouts.find((l) => l.shopId === shop.id)?.learned}
			<label
				class="border-input has-checked:border-primary has-checked:bg-[var(--fl-primary-tint)]
					flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2"
			>
				<input
					type="radio"
					name="active-shop"
					value={shop.id}
					checked={active}
					onchange={() => data.setActiveShop(shop.id)}
					data-test="shop-{shop.id}"
					class="sr-only"
				/>
				<span
					class="grid size-6 shrink-0 place-items-center rounded-full text-[0.625rem] font-semibold text-white"
					style="background: {shop.tint}"
					aria-hidden="true"
				>
					{shop.short}
				</span>
				<span class="text-label whitespace-nowrap">{shop.name}</span>
				{#if learned}
					<Check size={14} class="text-primary shrink-0" aria-label={t('list.learnedShop')} />
				{/if}
			</label>
		{/each}
	</div>
</fieldset>
