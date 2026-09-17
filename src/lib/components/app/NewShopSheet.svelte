<script lang="ts">
	import { settings } from '$stores/settings.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import type { Shop } from '$lib/db/schema';
	import ShopForm from '$components/app/ShopForm.svelte';
	import { X } from '@lucide/svelte';

	let { oncreated }: { oncreated?: (shop: Shop) => void } = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	/** Same contract as the other sheets: it is the browser that holds the open state. */
	export function show() {
		dialog?.showModal();
	}

	function hide() {
		dialog?.close();
	}
</script>

<!--
	Creating a shop without leaving what you were doing.

	You notice a shop is missing at the moment of attaching a loyalty card, not while visiting the shops
	screen. Sending people there would lose what they were typing.
-->
<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="new-shop-title"
	data-test-id="new-shop-sheet"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="new-shop-title" class="text-h2 pe-12 font-semibold">{t('shops.new')}</h2>

		<div class="mt-4">
			<ShopForm
				prefix="sheet-shop"
				oncreated={(shop) => {
					hide();
					oncreated?.(shop);
				}}
			/>
		</div>

		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="new-shop-close"
			class="bg-muted text-foreground absolute end-4 top-4 grid size-11 place-items-center rounded-full"
		>
			<X size={18} aria-hidden="true" />
		</button>
	</div>
</dialog>
