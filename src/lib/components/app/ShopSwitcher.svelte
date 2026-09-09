<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { tintForWhiteText } from '$domain/tint';
	import ShopPicker from '$components/app/ShopPicker.svelte';
	import { ChevronDown, Route } from '@lucide/svelte';

	let { compact = false }: { compact?: boolean } = $props();

	let picker = $state<ShopPicker | null>(null);

	const shop = $derived(data.activeShop);
	const appris = $derived(data.layouts.find((l) => l.shopId === shop?.id)?.learned ?? false);
</script>

<!--
	Le magasin actif, et de quoi en changer.

	Une barre et non une rangée de pastilles : à cinq ou six magasins, les pastilles débordaient de
	l'écran et il fallait les faire défiler pour voir lequel était choisi. Ici le magasin actif est
	toujours lu en entier, et la liste complète vit dans une feuille — c'est aussi là qu'il y a la
	place d'afficher l'adresse, qui est ce qui distingue deux magasins de la même enseigne.

	« Parcours appris » est écrit sur la barre : c'est ce qui explique pourquoi les rayons sont dans
	cet ordre-là, et l'information n'a d'intérêt que pour le magasin qu'on est en train de lire.
-->
{#if !shop}
	<p class="text-muted-foreground text-label">
		<a href="/shops" class="text-primary inline-flex min-h-[max(2.75rem,44px)] items-center underline">
			{t('list.noShop')}
		</a>
	</p>
{:else if compact}
	<!--
		La forme du pouce : ce qui reste quand il n'y a que la largeur d'une barre. Le trigramme et le
		nom suffisent à savoir où l'on est ; l'adresse et le parcours appris attendent dans la feuille.
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

		{#if appris}
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
				{#if appris}
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
