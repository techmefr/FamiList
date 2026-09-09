<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { TINTS } from '$domain/tint';
	import type { Shop } from '$lib/db/schema';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import IconField from '$components/app/IconField.svelte';
	import { Plus, Store, Building2, MapPin, RefreshCw } from '@lucide/svelte';

	/**
	 * Le formulaire de création d'un magasin, là où on en a besoin.
	 *
	 * Il vit sur l'écran des magasins, mais aussi dans une feuille appelée depuis ailleurs :
	 * enregistrer une carte de fidélité, c'est souvent découvrir qu'on n'a pas encore créé le
	 * magasin qui va avec. Faire sortir la personne du formulaire de la carte pour aller le créer
	 * ailleurs, c'est lui faire perdre ce qu'elle avait commencé à saisir.
	 *
	 * Les identifiants des champs sont préfixés : deux exemplaires du formulaire peuvent coexister
	 * sur une même page, et deux `for` identiques feraient pointer les deux étiquettes au même
	 * endroit.
	 */
	let {
		prefix = 'shop',
		oncreated
	}: { prefix?: string; oncreated?: (shop: Shop) => void } = $props();

	let brand = $state('');
	let name = $state('');
	let address = $state('');
	let short = $state('');

	const pris = $derived(data.shops.map((shop) => shop.short));

	/**
	 * Les enseignes déjà saisies dans le foyer, proposées à la frappe. On ne tient pas de
	 * catalogue de chaînes : la liste se remplit de ce que la famille fréquente vraiment, et un
	 * commerce indépendant n'a rien à y trouver.
	 */
	const enseignes = $derived([
		...new Set(data.shops.map((shop) => shop.brand.trim()).filter(Boolean))
	]);

	/** Ce que portera la pastille si personne ne remplit le champ. */
	const propose = $derived(data.proposedShort({ brand, name, address }));

	const saisi = $derived(short.trim().toUpperCase());

	/**
	 * Un trigramme déjà porté est refusé plutôt que corrigé en silence : quelqu'un qui tape CMX a
	 * une raison de le vouloir, et se retrouver avec CM2 sans explication est plus déroutant que
	 * de lire que la place est prise.
	 */
	const dejaPris = $derived(saisi.length > 0 && pris.some((court) => court.toUpperCase() === saisi));

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim() || dejaPris) return;

		feedback.play('add');
		const shop = data.addShop({
			brand,
			name,
			address,
			short,
			tint: TINTS[data.shops.length % TINTS.length]
		});

		brand = '';
		name = '';
		address = '';
		short = '';
		oncreated?.(shop);
	}
</script>

<form onsubmit={submit} class="space-y-3" data-test-id="add-shop">
	<div class="grid gap-3 sm:grid-cols-2">
		<!--
			L'enseigne d'abord, parce que c'est elle qui ouvre le trigramme et qui portera la carte.
			Facultative et annoncée comme telle : un salon de coiffure n'en a pas, et le formulaire
			ne doit pas donner l'impression qu'il en faut une.
		-->
		<div>
			<Label for="{prefix}-brand">{t('shops.brand')}</Label>
			<IconField icon={Building2}>
				<Input
					id="{prefix}-brand"
					bind:value={brand}
					data-test-id="shop-brand"
					list="{prefix}-brands"
					placeholder={t('shops.brandPlaceholder')}
				/>
			</IconField>
			<datalist id="{prefix}-brands">
				{#each enseignes as enseigne (enseigne)}
					<option value={enseigne}></option>
				{/each}
			</datalist>
		</div>
		<div>
			<Label for="{prefix}-name">{t('shops.name')}</Label>
			<IconField icon={Store}>
				<Input
					id="{prefix}-name"
					bind:value={name}
					data-test-id="shop-name"
					required
					placeholder={t('shops.namePlaceholder')}
				/>
			</IconField>
		</div>
	</div>

	<div class="grid gap-3 sm:grid-cols-[1fr_9rem]">
		<div>
			<Label for="{prefix}-address">{t('shops.address')}</Label>
			<IconField icon={MapPin}>
				<Input
					id="{prefix}-address"
					bind:value={address}
					data-test-id="shop-address"
					aria-describedby="{prefix}-address-hint"
					placeholder={t('shops.addressPlaceholder')}
				/>
			</IconField>
			<p id="{prefix}-address-hint" class="text-muted-foreground text-caption">
				{t('shops.addressHint')}
			</p>
		</div>
		<!--
			Le champ ne se remplit pas : il montre en filigrane ce qui sera pris si on n'y touche pas.
			Une valeur écrite d'office donnerait l'impression d'avoir été saisie, et il faudrait
			l'effacer pour revenir au trigramme automatique.

			Le bouton, lui, écrit la proposition dans le champ — pour la retoucher d'une lettre, ou
			pour revenir dessus après avoir corrigé l'enseigne ou la commune.
		-->
		<div>
			<Label for="{prefix}-short">{t('shops.short')}</Label>
			<IconField>
				<Input
					id="{prefix}-short"
					bind:value={short}
					data-test-id="shop-short"
					maxlength={3}
					placeholder={propose}
					autocapitalize="characters"
					aria-invalid={dejaPris}
					aria-describedby={dejaPris ? `${prefix}-short-error` : undefined}
					class="text-center uppercase"
				/>
				{#snippet action()}
					<button
						type="button"
						onclick={() => (short = propose)}
						disabled={!propose}
						aria-label={t('shops.shortRegenerate')}
						title={t('shops.shortRegenerate')}
						data-test-id="shop-short-regenerate"
						class="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none disabled:opacity-40"
					>
						<RefreshCw size={18} aria-hidden="true" />
					</button>
				{/snippet}
			</IconField>
		</div>
	</div>

	{#if dejaPris}
		<p
			id="{prefix}-short-error"
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
