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
	import EmojiPicker from '$components/app/EmojiPicker.svelte';
	import { Plus, Store, LayoutList } from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';

	let shopName = $state('');
	let shopShort = $state('');
	let aisleName = $state('');
	let aisleEmoji = $state('🛒');
	let picker = $state<EmojiPicker | null>(null);

	const pris = $derived(data.shops.map((shop) => shop.short));

	/** Ce que portera la pastille si personne ne remplit le champ. */
	const propose = $derived(trigram(shopName, pris));

	const saisi = $derived(shopShort.trim().toUpperCase());

	/**
	 * Un trigramme déjà porté est refusé plutôt que corrigé en silence : quelqu'un qui tape CMX a
	 * une raison de le vouloir, et se retrouver avec CM2 sans explication est plus déroutant que
	 * de lire que la place est prise.
	 */
	const dejaPris = $derived(saisi.length > 0 && pris.some((court) => court.toUpperCase() === saisi));

	function addShop(event: SubmitEvent) {
		event.preventDefault();
		if (!shopName.trim() || dejaPris) return;

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

<form onsubmit={addShop} class="bg-card mt-6 space-y-3 rounded-xl border p-4" data-test-id="add-shop">
	<div class="grid gap-3 sm:grid-cols-[1fr_auto]">
		<div>
			<Label for="shop-name">{t('shops.name')}</Label>
			<IconField icon={Store}>
				<Input
					id="shop-name"
					bind:value={shopName}
					data-test-id="shop-name"
					required
					placeholder={t('shops.namePlaceholder')}
				/>
			</IconField>
		</div>
		<!--
			Le champ ne se remplit pas : il montre en filigrane ce qui sera pris si on n'y touche pas.
			Une valeur écrite d'office donnerait l'impression d'avoir été saisie, et il faudrait
			l'effacer pour revenir au trigramme automatique.
		-->
		<div class="w-24">
			<Label for="shop-short">{t('shops.short')}</Label>
			<Input
				id="shop-short"
				bind:value={shopShort}
				data-test-id="shop-short"
				maxlength={3}
				placeholder={propose}
				autocapitalize="characters"
				aria-invalid={dejaPris}
				aria-describedby={dejaPris ? 'shop-short-error' : undefined}
				class="text-center uppercase"
			/>
		</div>
	</div>

	{#if dejaPris}
		<p
			id="shop-short-error"
			class="text-destructive text-caption"
			role="alert"
			data-test-id="shop-short-error"
		>
			{t('shops.shortTaken')}
		</p>
	{/if}
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

<form onsubmit={addAisle} class="bg-card mt-6 space-y-3 rounded-xl border p-4" data-test-id="add-aisle">
	<div class="grid gap-3 sm:grid-cols-[auto_1fr]">
		<div class="w-20">
			<Label for="aisle-emoji">{t('aisles.emoji')}</Label>
<!--
				Un champ texte pour un emoji suppose un clavier qui en propose : au bureau il n'y en a
				pas, et il fallait aller en chercher un ailleurs pour le coller ici. Le bouton montre
				celui qui est choisi et ouvre la palette.
			-->
			<button
				type="button"
				id="aisle-emoji"
				onclick={() => picker?.show()}
				aria-haspopup="dialog"
				data-test-id="aisle-emoji"
				class="border-input bg-background fl-press grid min-h-[max(2.75rem,44px)] w-full place-items-center rounded-lg border text-2xl"
			>
				<span aria-hidden="true">{aisleEmoji}</span>
				<span class="sr-only">{t('emojiPicker.current', { emoji: aisleEmoji })}</span>
			</button>
		</div>
		<div>
			<Label for="aisle-name">{t('aisles.name')}</Label>
			<IconField icon={LayoutList}>
				<Input
					id="aisle-name"
					bind:value={aisleName}
					data-test-id="aisle-name"
					required
					placeholder={t('aisles.namePlaceholder')}
				/>
			</IconField>
		</div>
	</div>
	<Button type="submit" data-test-id="aisle-create">
		<Plus size={18} aria-hidden="true" />
		{t('aisles.new')}
	</Button>
</form>

<ul class="mt-6 flex flex-wrap gap-2">
	{#each data.aisles as aisle (aisle.id)}
		<li class="border-input rounded-full border px-4 py-2" data-test-class="aisle-chip">
			<span aria-hidden="true">{aisle.emoji}</span>
			<span class="text-label">{aisle.name}</span>
		</li>
	{/each}
</ul>

<EmojiPicker bind:this={picker} value={aisleEmoji} onpick={(choix) => (aisleEmoji = choix)} />
