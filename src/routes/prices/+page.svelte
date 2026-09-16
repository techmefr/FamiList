<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { formatAmount } from '$domain/price';
	import { tintForWhiteText } from '$domain/tint';
	import * as Card from '$lib/components/ui/card';
	import EmptyState from '$components/app/EmptyState.svelte';

	const produits = $derived(data.pricedProducts);

	const shopName = (id: string) =>
		data.shops.find((shop) => shop.id === id)?.name ?? t('prices.goneShop');

	const shopShort = (id: string) => data.shops.find((shop) => shop.id === id)?.short ?? '?';

	const shopTint = (id: string) => data.shops.find((shop) => shop.id === id)?.tint ?? '#5A4A2F';

	/** La date du relevé, dans la langue lue : un prix d'il y a six mois ne vaut pas celui d'hier. */
	const jour = (recordedAt: number) =>
		new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'medium' }).format(new Date(recordedAt));
</script>

<!--
	L'historique des prix.

	Une liste par produit, et sous chaque produit ses magasins du moins cher au plus cher. Pas de
	courbe : ce que le foyer vient chercher, c'est où acheter ce produit — une comparaison à un
	instant, pas une tendance. Le dernier prix connu de chaque magasin suffit à la donner, et la date
	dit ce qu'il vaut encore.
-->
<svelte:head>
	<title>{t('prices.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 pt-2 font-semibold">{t('prices.title')}</h1>
<p class="text-muted-foreground text-label mt-1">{t('prices.intro')}</p>

{#if produits.length === 0}
	<EmptyState illustration="cart" text={t('prices.empty')} testId="prices-empty" />
{:else}
	<div class="mt-6 flex flex-col gap-4" data-test-id="prices-list">
		{#each produits as produit (produit.slug)}
			{@const magasins = data.priceComparison(produit.slug)}
			<Card.Root data-test-class="price-product">
				<Card.Header>
					<Card.Title class="text-product break-words">{produit.name}</Card.Title>
					<Card.Description>
						{t('prices.shopCount', { count: produit.shopCount })}
					</Card.Description>
				</Card.Header>

				<Card.Content>
					<ul class="flex flex-col gap-2">
						{#each magasins as releve, rang (releve.id)}
							<li class="flex items-center gap-3" data-test-class="price-shop">
								<span
									class="text-caption grid size-9 shrink-0 place-items-center rounded-md font-semibold text-white"
									style="background: {tintForWhiteText(shopTint(releve.shopId))}"
									aria-hidden="true"
								>
									{shopShort(releve.shopId)}
								</span>

								<span class="min-w-0 flex-1">
									<span class="text-label block font-medium break-words">
										{shopName(releve.shopId)}
									</span>
									<span class="text-caption text-muted-foreground">
										{t('prices.recordedOn', { date: jour(releve.recordedAt) })}
									</span>
								</span>

								<!--
									Le moins cher est dit en toutes lettres et pas seulement par sa place dans la
									liste : « le premier de la liste » ne se lit ni au lecteur d'écran ni d'un
									coup d'œil quand deux prix se ressemblent.
								-->
								<span class="text-end">
									<span class="text-product font-semibold {rang === 0 ? 'text-secondary' : ''}">
										{formatAmount(releve.amount, releve.currency, i18n.locale)}
									</span>
									{#if rang === 0 && magasins.length > 1}
										<span class="text-caption text-secondary block font-medium">
											{t('prices.cheapest')}
										</span>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
{/if}
