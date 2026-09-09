<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { tintForWhiteText } from '$domain/tint';
	import type { Shop } from '$lib/db/schema';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import EmojiPicker from '$components/app/EmojiPicker.svelte';
	import ShopForm from '$components/app/ShopForm.svelte';
	import { Plus, LayoutList, MapPin } from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';

	let aisleName = $state('');
	let aisleEmoji = $state('🛒');
	let picker = $state<EmojiPicker | null>(null);

	/**
	 * Le magasin dont on relève la position, et le dernier échec. Un seul relevé à la fois : le GPS
	 * met quelques secondes, et deux demandes en parallèle donneraient deux réponses à ranger.
	 */
	let releve = $state<string | null>(null);
	let erreurGps = $state('');

	/**
	 * La position du magasin, prise sur place.
	 *
	 * C'est l'appareil qui la donne, pas un service de géocodage : l'adresse ne sort jamais du
	 * téléphone, il n'y a ni clé d'API ni quota, et la chose marche sans réseau. En échange il faut
	 * être devant le magasin — ce qui tombe bien, on y est quand on fait ses courses.
	 *
	 * Elle sert à retrouver le magasin quand on y revient, pour sortir la bonne carte de fidélité
	 * sans la chercher.
	 */
	function releverPosition(shop: Shop) {
		if (!navigator.geolocation) {
			erreurGps = t('shops.geoUnavailable');
			return;
		}

		releve = shop.id;
		erreurGps = '';

		navigator.geolocation.getCurrentPosition(
			(position) => {
				data.updateShop(shop.id, {
					lat: position.coords.latitude,
					lng: position.coords.longitude
				});
				releve = null;
			},
			() => {
				erreurGps = t('shops.geoDenied');
				releve = null;
			},
			{ enableHighAccuracy: true, timeout: 15000 }
		);
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

<div class="bg-card mt-6 rounded-xl border p-4">
	<ShopForm />
</div>

{#if erreurGps}
	<p class="text-destructive mt-6" role="alert" data-test-id="shop-geo-error">{erreurGps}</p>
{/if}

{#if data.shops.length === 0}
	<EmptyState illustration="shop" text={t('shops.empty')} testId="shops-empty" />
{:else}
	<ul class="mt-6 space-y-3">
		{#each data.shops as shop (shop.id)}
			{@const learned = data.layouts.find((l) => l.shopId === shop.id)?.learned}
			{@const situe = shop.lat !== undefined && shop.lng !== undefined}
			<li>
				<Card.Root data-test-class="shop-card">
					<Card.Content>
						<div class="flex flex-wrap items-center gap-x-4 gap-y-3">
							<span
								class="text-label grid size-11 shrink-0 place-items-center rounded-full font-semibold text-white"
								style="background: {tintForWhiteText(shop.tint)}"
								aria-hidden="true"
							>
								{shop.short}
							</span>
							<div class="min-w-0 flex-1 basis-[10rem]">
								<p class="text-product font-medium break-words">{shop.name}</p>
								{#if shop.address || shop.dist}
									<p class="text-muted-foreground text-caption break-words">
										{shop.address || shop.dist}
									</p>
								{/if}
							</div>
							<Badge variant={shop.isDefault ? 'outline' : learned ? 'default' : 'secondary'}>
								{shop.isDefault
									? t('shops.defaultBadge')
									: learned
										? t('shops.learned')
										: t('shops.notLearned')}
							</Badge>
						</div>

						<!--
							Le relevé de position vit sur la fiche du magasin et pas dans le formulaire : on
							l'enregistre en y étant, c'est-à-dire longtemps après l'avoir créé.
						-->
						<div class="mt-3 flex flex-wrap items-center gap-3">
							<Button
								variant="outline"
								onclick={() => releverPosition(shop)}
								disabled={releve !== null}
								data-test-class="shop-locate"
							>
								<MapPin size={18} aria-hidden="true" />
								{releve === shop.id
									? t('shops.locating')
									: situe
										? t('shops.relocate')
										: t('shops.locate')}
							</Button>
							{#if situe}
								<p
									class="text-muted-foreground text-caption"
									role="status"
									data-test-class="shop-located"
								>
									{t('shops.located')}
								</p>
							{/if}
						</div>
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
