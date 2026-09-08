<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { TINTS, tintForWhiteText } from '$domain/tint';
	import { trigram } from '$domain/trigram';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Plus } from '@lucide/svelte';

	let shopName = $state('');
	let shopShort = $state('');
	let aisleName = $state('');
	let aisleEmoji = $state('🛒');

	function addShop(event: SubmitEvent) {
		event.preventDefault();
		if (!shopName.trim()) return;

		data.addShop({
			name: shopName,
			short: shopShort,
			tint: TINTS[data.shops.length % TINTS.length]
		});
		shopName = '';
		shopShort = '';
	}

	function addAisle(event: SubmitEvent) {
		event.preventDefault();
		if (!aisleName.trim()) return;

		data.addAisle({ name: aisleName, emoji: aisleEmoji });
		aisleName = '';
		aisleEmoji = '🛒';
	}
</script>

<svelte:head>
	<title>{t('shops.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('shops.title')}</h1>

<form onsubmit={addShop} class="bg-card mt-6 space-y-3 rounded-md border p-4" data-test-id="add-shop">
	<div class="grid gap-3 sm:grid-cols-[1fr_auto]">
		<div>
			<Label for="shop-name">{t('shops.name')}</Label>
			<Input id="shop-name" bind:value={shopName} data-test-id="shop-name" required />
		</div>
		<!--
			Le champ ne se remplit pas : il montre en place ce qui sera pris si on n'y touche pas. Une
			valeur écrite d'office donnerait l'impression d'avoir été saisie, et il faudrait l'effacer
			pour revenir au trigramme automatique.
		-->
		<div class="w-24">
			<Label for="shop-short">{t('shops.short')}</Label>
			<Input
				id="shop-short"
				bind:value={shopShort}
				data-test-id="shop-short"
				maxlength={3}
				placeholder={trigram(shopName)}
				autocapitalize="characters"
				class="text-center uppercase"
			/>
		</div>
	</div>
	<Button type="submit" data-test-id="shop-create">
		<Plus size={18} aria-hidden="true" />
		{t('shops.new')}
	</Button>
</form>

{#if data.shops.length === 0}
	<p class="text-muted-foreground mt-6">{t('shops.empty')}</p>
{:else}
	<ul class="mt-6 space-y-3">
		{#each data.shops as shop (shop.id)}
			{@const learned = data.layouts.find((l) => l.shopId === shop.id)?.learned}
			<li>
				<Card.Root data-test-class="shop-card">
					<Card.Content class="flex flex-wrap items-center gap-x-4 gap-y-3">
						<span
							class="grid size-11 shrink-0 place-items-center rounded-full text-label font-semibold text-white"
							style="background: {tintForWhiteText(shop.tint)}"
							aria-hidden="true"
						>
							{shop.short}
						</span>
						<div class="min-w-0 flex-1 basis-[10rem]">
							<p class="text-product font-medium break-words">{shop.name}</p>
							{#if shop.dist}
								<p class="text-muted-foreground text-caption">{shop.dist}</p>
							{/if}
						</div>
						<Badge variant={learned ? 'default' : 'secondary'}>
							{learned ? t('shops.learned') : t('shops.notLearned')}
						</Badge>
					</Card.Content>
				</Card.Root>
			</li>
		{/each}
	</ul>
{/if}

<h2 class="text-h2 mt-10 font-semibold">{t('aisles.title')}</h2>
<p class="text-muted-foreground text-label mt-1">{t('aisles.hint')}</p>

<form onsubmit={addAisle} class="bg-card mt-4 space-y-3 rounded-md border p-4" data-test-id="add-aisle">
	<div class="grid gap-3 sm:grid-cols-[auto_1fr]">
		<div class="w-20">
			<Label for="aisle-emoji">{t('aisles.emoji')}</Label>
			<Input id="aisle-emoji" bind:value={aisleEmoji} data-test-id="aisle-emoji" maxlength={2} />
		</div>
		<div>
			<Label for="aisle-name">{t('aisles.name')}</Label>
			<Input id="aisle-name" bind:value={aisleName} data-test-id="aisle-name" required />
		</div>
	</div>
	<Button type="submit" data-test-id="aisle-create">
		<Plus size={18} aria-hidden="true" />
		{t('aisles.new')}
	</Button>
</form>

<ul class="mt-4 flex flex-wrap gap-2">
	{#each data.aisles as aisle (aisle.id)}
		<li class="border-input rounded-full border px-4 py-2" data-test-class="aisle-chip">
			<span aria-hidden="true">{aisle.emoji}</span>
			<span class="text-label">{aisle.name}</span>
		</li>
	{/each}
</ul>
