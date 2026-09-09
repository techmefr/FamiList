<script lang="ts">
	import { settings } from '$stores/settings.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import type { Shop } from '$lib/db/schema';
	import ShopForm from '$components/app/ShopForm.svelte';
	import { X } from '@lucide/svelte';

	let { oncreated }: { oncreated?: (shop: Shop) => void } = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	/** Même contrat que les autres feuilles : c'est le navigateur qui tient l'état ouvert. */
	export function show() {
		dialog?.showModal();
	}

	function hide() {
		dialog?.close();
	}
</script>

<!--
	Créer un magasin sans quitter ce qu'on était en train de faire.

	On s'aperçoit qu'un magasin manque au moment de rattacher une carte de fidélité, pas en allant
	visiter l'écran des magasins. Renvoyer là-bas ferait perdre la saisie en cours.
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
