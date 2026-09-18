<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { settings } from '$stores/settings.svelte';
	import { tintForWhiteText } from '$domain/tint';
	import { t } from '$i18n/index.svelte';
	import { X, Check, Plus, Route } from '@lucide/svelte';

	let dialog = $state<HTMLDialogElement | null>(null);

	/**
	 * Same contract as the other sheets: the browser holds the open/closed state, we do not double it with a
	 * boolean that would end up lying as soon as Escape closes the sheet without us.
	 */
	export function show() {
		dialog?.showModal();
	}

	function hide() {
		dialog?.close();
	}

	function choose(shopId: string) {
		feedback.play('tap');
		data.setActiveShop(shopId);
		hide();
	}

	/** What tells two shops of the same brand apart: where they are. */
	function locationLabel(address: string, dist?: string) {
		return [address.trim(), dist?.trim()].filter(Boolean).join(' • ');
	}
</script>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="shop-picker-title"
	data-test-id="shop-picker"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="shop-picker-title" class="text-h2 pe-12 font-semibold">{t('list.chooseShop')}</h2>

		<ul class="mt-4 space-y-1">
			{#each data.shops as shop (shop.id)}
				{@const enabled = data.activeShopId === shop.id}
				{@const learned = data.layouts.find((l) => l.shopId === shop.id)?.learned}
				<li>
					<button
						type="button"
						onclick={() => choose(shop.id)}
						aria-current={enabled ? 'true' : undefined}
						data-test-class="shop-choice"
						class="hover:bg-muted aria-[current]:bg-[var(--fl-primary-tint)] flex min-h-[max(3.5rem,56px)] w-full cursor-pointer items-center gap-3 rounded-lg px-2 text-start transition-colors"
					>
						<span
							class="text-label grid size-11 shrink-0 place-items-center rounded-md font-semibold text-white"
							style="background: {tintForWhiteText(shop.tint)}"
							aria-hidden="true"
						>
							{shop.short}
						</span>

						<span class="min-w-0 flex-1">
							<span class="text-label block font-medium break-words">{shop.name}</span>
							<span class="text-muted-foreground text-caption flex flex-wrap items-center gap-x-2">
								{#if locationLabel(shop.address, shop.dist)}
									<span class="break-words">{locationLabel(shop.address, shop.dist)}</span>
								{/if}
								{#if learned}
									<span class="text-secondary inline-flex items-center gap-1 font-semibold">
										<Route size={12} aria-hidden="true" />
										{t('list.learnedShop')}
									</span>
								{/if}
							</span>
						</span>

						{#if enabled}
							<Check size={22} class="text-primary shrink-0" aria-hidden="true" />
						{/if}
					</button>
				</li>
			{/each}
		</ul>

		<!--
			Adding a shop from the sheet: this is where you notice it is missing, not in the settings screen. The
			dashed outline tells it from the real shops without making it one more control to ignore.
		-->
		<a
			href="/shops"
			onclick={hide}
			data-test-id="shop-picker-add"
			class="border-input text-primary mt-3 flex min-h-[max(3.5rem,56px)] items-center gap-3 rounded-lg border border-dashed px-2"
		>
			<span
				class="grid size-11 shrink-0 place-items-center rounded-md bg-[var(--fl-primary-tint)]"
				aria-hidden="true"
			>
				<Plus size={22} />
			</span>
			<span class="text-label font-medium">{t('shops.new')}</span>
		</a>

		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="shop-picker-close"
			class="bg-muted text-foreground absolute end-4 top-4 grid size-11 place-items-center rounded-full"
		>
			<X size={18} aria-hidden="true" />
		</button>
	</div>
</dialog>
