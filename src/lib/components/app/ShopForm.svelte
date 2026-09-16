<script lang="ts">
	import { untrack } from 'svelte';
	import { data } from '$stores/data.svelte';
	import { sync } from '$lib/sync/index.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { TINTS } from '$domain/tint';
	import type { Shop } from '$lib/db/schema';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import IconField from '$components/app/IconField.svelte';
	import { Plus, Store, Building2, MapPin, RefreshCw, Check } from '@lucide/svelte';

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
	/**
	 * Avec `shop`, le même formulaire modifie au lieu de créer : les champs sont ceux de la
	 * création, les règles sur le trigramme aussi, et un second formulaire d'édition n'aurait fait
	 * que les répéter à l'identique — en laissant les deux diverger avec le temps.
	 */
	let {
		prefix = 'shop',
		shop: edite,
		oncreated,
		onsaved,
		oncancel
	}: {
		prefix?: string;
		shop?: Shop;
		oncreated?: (shop: Shop) => void;
		onsaved?: () => void;
		oncancel?: () => void;
	} = $props();

	// Les champs partent du magasin tel qu'il est à l'ouverture, et lui appartiennent ensuite : le
	// formulaire est remonté à chaque édition, et une mise à jour venue de la synchronisation ne
	// doit pas écraser une saisie en cours.
	let brand = $state(untrack(() => edite?.brand ?? ''));
	let name = $state(untrack(() => edite?.name ?? ''));
	let address = $state(untrack(() => edite?.address ?? ''));
	let short = $state(untrack(() => edite?.short ?? ''));
	let lat = $state(untrack(() => edite?.lat));
	let lng = $state(untrack(() => edite?.lng));

	let releve = $state(false);
	let erreurGps = $state('');

	const situe = $derived(lat !== undefined && lng !== undefined);

	/**
	 * La position du magasin, prise sur place, par le pin du champ adresse.
	 *
	 * C'est l'appareil qui la donne, pas un service de géocodage : l'adresse ne sort jamais du
	 * téléphone, il n'y a ni clé d'API ni quota, et la chose marche sans réseau. En échange il faut
	 * être devant le magasin — ce qui tombe bien, on y est quand on fait ses courses.
	 *
	 * Elle sert à retrouver le magasin quand on y revient, pour sortir la bonne carte de fidélité
	 * sans la chercher. Le pin ne remplit que les coordonnées : l'adresse reste écrite à la main.
	 *
	 * Dans le formulaire et non sur la fiche du magasin : on peut désormais poser la position en
	 * créant le magasin, alors qu'il fallait le créer puis revenir sur sa fiche.
	 */
	function releverPosition() {
		if (!navigator.geolocation) {
			erreurGps = t('shops.geoUnavailable');
			return;
		}

		releve = true;
		erreurGps = '';

		navigator.geolocation.getCurrentPosition(
			(position) => {
				lat = position.coords.latitude;
				lng = position.coords.longitude;
				releve = false;
				// En modification, la position vaut pour elle-même : on la relève devant le magasin,
				// pas au moment où l'on pense à enregistrer le reste du formulaire.
				if (edite) data.updateShop(edite.id, { lat, lng });
			},
			() => {
				erreurGps = t('shops.geoDenied');
				releve = false;
			},
			{ enableHighAccuracy: true, timeout: 15000 }
		);
	}

	// Le trigramme du magasin qu'on modifie ne se compte pas comme pris par un autre : le garder
	// tel quel doit rester possible.
	const pris = $derived(
		data.shops.filter((shop) => shop.id !== edite?.id).map((shop) => shop.short)
	);

	/**
	 * Les enseignes déjà saisies dans le foyer, proposées à la frappe. On ne tient pas de
	 * catalogue de chaînes : la liste se remplit de ce que la famille fréquente vraiment, et un
	 * commerce indépendant n'a rien à y trouver.
	 */
	const enseignes = $derived([
		...new Set(data.shops.map((shop) => shop.brand.trim()).filter(Boolean))
	]);

	/** Ce que portera la pastille si personne ne remplit le champ. */
	const propose = $derived(data.proposedShort({ brand, name, address }, edite?.id));

	const saisi = $derived(short.trim().toUpperCase());

	/**
	 * Un trigramme déjà porté est refusé plutôt que corrigé en silence : quelqu'un qui tape CMX a
	 * une raison de le vouloir, et se retrouver avec CM2 sans explication est plus déroutant que
	 * de lire que la place est prise.
	 */
	const dejaPris = $derived(saisi.length > 0 && pris.some((court) => court.toUpperCase() === saisi));

	/**
	 * Créer avant que la première synchronisation soit retombée, c'est choisir un trigramme et une
	 * teinte parmi un cache encore vide : le magasin prend alors ceux d'un autre. On attend, plutôt
	 * que d'avoir à corriger après coup un magasin que son doublon rend non modifiable.
	 *
	 * Seulement à la création : modifier un magasin suppose qu'on le voit déjà.
	 */
	const attendSynchro = $derived(!edite && !sync.settled);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim() || dejaPris || attendSynchro) return;

		if (edite) {
			feedback.play('success');
			// Le trigramme laissé vide revient à celui que la pastille montre déjà : on ne le vide
			// jamais, un magasin sans pastille n'existe pas.
			data.updateShop(edite.id, {
				brand: brand.trim(),
				name: name.trim(),
				address: address.trim(),
				short: saisi || edite.short
			});
			onsaved?.();
			return;
		}

		feedback.play('add');
		const shop = data.addShop({
			brand,
			name,
			address,
			short,
			lat,
			lng,
			tint: TINTS[data.shops.length % TINTS.length]
		});

		brand = '';
		name = '';
		address = '';
		short = '';
		lat = undefined;
		lng = undefined;
		erreurGps = '';
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
			<!--
				Le pin n'est pas décoratif : il pose la position relevée par l'appareil. Il ne touche
				pas à l'adresse écrite au-dessus — aucun service de géocodage n'est appelé, et rien de
				ce qui est saisi ne sort du téléphone.
			-->
			<IconField>
				<Input
					id="{prefix}-address"
					bind:value={address}
					data-test-id="shop-address"
					aria-describedby="{prefix}-address-hint"
					placeholder={t('shops.addressPlaceholder')}
				/>
				{#snippet action()}
					{@const libelle = releve
						? t('shops.locating')
						: situe
							? t('shops.relocate')
							: t('shops.locate')}
					<button
						type="button"
						onclick={releverPosition}
						disabled={releve}
						aria-label={libelle}
						title={libelle}
						data-test-class="shop-locate"
						class={'hover:text-foreground focus-visible:ring-ring flex size-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none disabled:opacity-40 ' +
							(situe ? 'text-primary' : 'text-muted-foreground')}
					>
						<MapPin size={18} aria-hidden="true" />
					</button>
				{/snippet}
			</IconField>
			<p id="{prefix}-address-hint" class="text-muted-foreground text-caption">
				{t('shops.addressHint')}
			</p>
			{#if erreurGps}
				<p class="text-destructive text-caption" role="alert" data-test-id="shop-geo-error">
					{erreurGps}
				</p>
			{/if}
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

	{#if edite}
		<div class="flex flex-wrap items-stretch gap-2">
			<Button type="submit" data-test-class="shop-save">
				<Check size={18} aria-hidden="true" />
				{t('shops.save')}
			</Button>
			<Button type="button" variant="outline" onclick={() => oncancel?.()} data-test-class="shop-cancel">
				{t('shops.cancel')}
			</Button>
		</div>
	{:else}
		<Button type="submit" disabled={attendSynchro} data-test-id="shop-create">
			<Plus size={18} aria-hidden="true" />
			{t('shops.new')}
		</Button>
		{#if attendSynchro}
			<p class="text-muted-foreground text-caption mt-2" role="status" data-test-id="shop-waiting">
				{t('shops.waitingSync')}
			</p>
		{/if}
	{/if}
</form>
