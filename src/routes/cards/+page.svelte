<script lang="ts">
	import { flip } from 'svelte/animate';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { motionMs } from '$stores/settings.svelte';
	import { createIntent } from '$stores/create.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { CODE_TYPES, guessCodeType, isMatrixFormat, type CodeType } from '$domain/code-format';
	import { linearCode } from '$domain/barcode';
	import { CARD_GRADIENT_END, DEFAULT_TINT } from '$domain/tint';
	import LoyaltyCardFace from '$components/app/LoyaltyCardFace.svelte';
	import CardFullscreen from '$components/app/CardFullscreen.svelte';
	import ScanButton from '$components/app/ScanButton.svelte';
	import ImportCodeButton from '$components/app/ImportCodeButton.svelte';
	import NewShopSheet from '$components/app/NewShopSheet.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Plus, Trash2, ScanLine, CreditCard, Barcode, Star, Store } from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';

	let openCardId = $state<string | null>(null);
	let adding = $state(false);

	/**
	 * Le bouton central annonce ce qu'il vient chercher. Le formulaire de carte reste replié tant
	 * qu'on ne l'a pas demandé : sans cela, le curseur arriverait sur un écran sans champ.
	 */
	$effect(() => {
		if (createIntent.take('card')) adding = true;
	});

	let name = $state('');
	let code = $state('');
	let codeType = $state<CodeType | ''>('');
	let points = $state('0');

	/**
	 * À quoi la carte est rattachée : `shop:<id>`, `brand:<enseigne>`, ou rien.
	 *
	 * Le rattachement était deviné en comparant le nom de la carte à celui des magasins, ce qui
	 * cassait au premier renommage et ne pouvait pas exprimer le cas courant — une carte Carrefour
	 * marche dans tous les Carrefour, pas seulement celui de Meximieux. Il se choisit donc, et le
	 * choix distingue les deux portées.
	 */
	let attach = $state('');

	/**
	 * Créer un magasin sans quitter la carte.
	 *
	 * On s'aperçoit qu'un magasin manque exactement ici : au moment de rattacher la carte. La liste
	 * porte donc une dernière entrée qui ouvre le formulaire dans une feuille, et le magasin créé
	 * devient le rattachement choisi — sans que la saisie en cours ne soit perdue.
	 *
	 * Un `<select>` ne peut pas ouvrir une boîte de dialogue pendant son propre changement : on
	 * remet la valeur d'avant, puis on ouvre.
	 */
	const NOUVEAU = '__new__';
	let nouveauMagasin = $state<NewShopSheet | null>(null);
	let avantNouveau = '';

	function surChangementRattachement(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		if (select.value !== NOUVEAU) {
			avantNouveau = select.value;
			return;
		}

		attach = avantNouveau;
		nouveauMagasin?.show();
	}

	const openCard = $derived(data.cards.find((c) => c.id === openCardId) ?? null);

	/** Le format suit la saisie tant que l'utilisateur n'en a pas imposé un. */
	const effectiveType = $derived(codeType || (code.trim() ? guessCodeType(code) : 'code_39'));

	/**
	 * Un format que la saisie ne peut pas former est signalé à la saisie, pas à la caisse : sinon
	 * la carte s'enregistre et ne se dessine plus le jour où on en a besoin.
	 */
	const invalidCode = $derived(
		!isMatrixFormat(effectiveType) && code.trim() !== '' && !linearCode(code, effectiveType)
	);

	const enseignes = $derived([
		...new Set(data.shops.map((shop) => shop.brand.trim()).filter(Boolean))
	]);

	const magasin = $derived(
		attach.startsWith('shop:')
			? (data.shops.find((shop) => shop.id === attach.slice(5)) ?? null)
			: null
	);

	/** Un magasin rattaché apporte son enseigne avec lui : la carte vaut alors pour la chaîne. */
	const enseigne = $derived(
		attach.startsWith('brand:') ? attach.slice(6) : (magasin?.brand.trim() ?? '')
	);

	/**
	 * La couleur vient du magasin, à défaut du premier magasin de l'enseigne : deux cartes de la
	 * même chaîne se ressemblent, et c'est ce qu'on cherche à la caisse.
	 */
	const tint = $derived(
		magasin?.tint ??
			(enseigne
				? (data.shops.find((shop) => shop.brand.trim() === enseigne)?.tint ?? DEFAULT_TINT)
				: DEFAULT_TINT)
	);

	/** Le rattachement nomme la carte tant qu'on ne lui donne pas un autre nom. */
	const suggestion = $derived(magasin?.name ?? enseigne);
	const libelle = $derived(name.trim() || suggestion);

	function reset() {
		adding = false;
		name = '';
		code = '';
		codeType = '';
		points = '0';
		attach = '';
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!libelle || !code.trim() || invalidCode) return;

		feedback.play('add');
		data.addCard({
			shopId: magasin?.id ?? '',
			brand: enseigne,
			name: libelle,
			num: `•••• •••• ${code.trim().slice(-4)}`,
			code: code.trim(),
			codeType: effectiveType,
			points: Number(points) || 0,
			tint,
			grad: `linear-gradient(135deg, ${tint} 0%, ${CARD_GRADIENT_END} 100%)`
		});

		reset();
	}
</script>

<svelte:head>
	<title>{t('cards.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('cards.title')}</h1>

{#if !data.ready}
	<p class="text-muted-foreground mt-6">{t('common.loading')}</p>
{:else}
	<p
		class="text-label text-primary mt-6 flex items-center gap-3 rounded-md bg-[var(--fl-primary-tint)] p-4"
	>
		<ScanLine size={20} aria-hidden="true" class="shrink-0" />
		{t('cards.tapHint')}
	</p>

	{#if data.cards.length === 0}
		<EmptyState illustration="cards" text={t('cards.empty')} testId="cards-empty" />
	{:else}
		<ul class="mt-6 space-y-4">
			{#each data.cards as card, index (card.id)}
				<li
					class="fl-rise relative"
					style="animation-delay: {Math.min(index, 6) * 45}ms"
					animate:flip={{ duration: motionMs(280), easing: cubicOut }}
					out:slide={{ duration: motionMs(180), easing: cubicOut }}
				>
					<button
						type="button"
						onclick={() => {
							feedback.play('tap');
							openCardId = card.id;
						}}
						class="fl-press block w-full text-start"
						data-test-class="card-open"
					>
						<LoyaltyCardFace {card} />
					</button>
					<button
						type="button"
						onclick={() => {
							feedback.play('remove');
							data.removeCard(card.id);
						}}
						aria-label={t('cards.delete', { name: card.name })}
						data-test-class="card-delete"
						class="fl-press absolute end-2 bottom-2 grid size-11 min-w-[44px] place-items-center text-white/70"
					>
						<Trash2 size={18} aria-hidden="true" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if adding}
		<form
			onsubmit={submit}
			transition:slide={{ duration: motionMs(220), easing: cubicOut }}
			class="bg-card mt-6 space-y-4 rounded-xl border p-4"
			data-test-id="card-form"
		>
			<!--
				Le rattachement en premier : c'est lui qui donne le nom, la couleur, et plus tard le
				rappel à l'arrivée devant le magasin. Le choix reste facultatif — une carte de
				bibliothèque ou de piscine ne se rattache à rien de ce qui est dans la liste.
			-->
			<div>
				<Label for="card-attach">{t('cards.attach')}</Label>
				<IconField icon={Store}>
					<select
						id="card-attach"
						bind:value={attach}
						onchange={surChangementRattachement}
						data-test-id="card-attach"
						aria-describedby="card-attach-hint"
						class="border-input bg-background min-h-[max(2.75rem,44px)] w-full rounded-md border"
					>
						<option value="">{t('cards.attachNone')}</option>
						{#if enseignes.length > 0}
							<optgroup label={t('cards.attachBrands')}>
								{#each enseignes as marque (marque)}
									<option value={`brand:${marque}`}>{marque}</option>
								{/each}
							</optgroup>
						{/if}
						{#if data.shops.length > 0}
							<optgroup label={t('cards.attachShops')}>
								{#each data.shops as shop (shop.id)}
									<option value={`shop:${shop.id}`}>{shop.name}</option>
								{/each}
							</optgroup>
						{/if}
						<option value={NOUVEAU}>{t('cards.attachNew')}</option>
					</select>
				</IconField>
				<p id="card-attach-hint" class="text-muted-foreground text-caption">
					{t('cards.attachHint')}
				</p>
			</div>

			<!--
				Le nom n'est plus obligatoire : le rattachement le donne, et il s'affiche en filigrane
				pour qu'on voie ce qui sera pris. On ne le remplit que pour distinguer deux cartes du
				même magasin — celle de la mère et celle du père.
			-->
			<div>
				<Label for="card-name">{t('cards.name')}</Label>
				<IconField icon={CreditCard}>
					<Input
						id="card-name"
						bind:value={name}
						data-test-id="card-name"
						required={!suggestion}
						placeholder={suggestion || t('cards.namePlaceholder')}
					/>
				</IconField>
			</div>

			<div>
				<Label for="card-code">{t('cards.code')}</Label>
				<IconField icon={Barcode}>
					<Input
						id="card-code"
						bind:value={code}
						data-test-id="card-code"
						required
						placeholder={t('cards.codePlaceholder')}
					/>
				</IconField>
				<!--
					Deux chemins vers le même code : la caméra, et une image déjà sur l'appareil. Le second
					n'est pas un repli — c'est le chemin normal quand on enregistre ses cartes assis
					devant un ordinateur, la carte étant dans un courriel ou dans une vieille photo.
				-->
				<ScanButton
					onScanned={(result) => {
						code = result.value;
						if (result.codeType) codeType = result.codeType;
					}}
				>
					{#snippet actions()}
						<ImportCodeButton
							onScanned={(result) => {
								code = result.value;
								if (result.codeType) codeType = result.codeType;
							}}
						/>
					{/snippet}
				</ScanButton>
				{#if invalidCode}
					<p class="text-destructive text-caption mt-1" role="alert" data-test-id="card-code-error">
						{t('cards.formatInvalid', { format: t(`cards.type.${effectiveType}`) })}
					</p>
				{/if}
			</div>

			<div>
				<Label for="card-type">{t('cards.format')}</Label>
				<IconField icon={ScanLine}>
					<select
						id="card-type"
						bind:value={codeType}
						data-test-id="card-type"
						class="border-input bg-background min-h-[max(2.75rem,44px)] w-full rounded-md border"
					>
						<option value="">{t('cards.formatAuto', { format: t(`cards.type.${effectiveType}`) })}</option>
						{#each CODE_TYPES as type (type)}
							<option value={type}>{t(`cards.type.${type}`)}</option>
						{/each}
					</select>
				</IconField>
			</div>

			<div>
				<Label for="card-points">{t('cards.points')}</Label>
				<IconField icon={Star}>
					<Input
						id="card-points"
						bind:value={points}
						inputmode="numeric"
						data-test-id="card-points"
						placeholder={t('cards.pointsPlaceholder')}
					/>
				</IconField>
			</div>

			<div class="flex flex-wrap gap-2">
				<Button type="submit" data-test-id="card-submit" class="fl-press">{t('cards.save')}</Button>
				<Button type="button" variant="outline" onclick={reset}>{t('common.cancel')}</Button>
			</div>
		</form>
	{:else}
		<Button
			variant="outline"
			onclick={() => {
				feedback.play('tap');
				adding = true;
			}}
			data-test-id="card-add"
			class="fl-press mt-6 w-full border-dashed py-6"
		>
			<Plus size={20} aria-hidden="true" />
			{t('cards.add')}
		</Button>
	{/if}

	<p class="text-muted-foreground text-caption mt-6">{t('cards.secretNotice')}</p>
{/if}

{#if openCard}
	<CardFullscreen card={openCard} onClose={() => (openCardId = null)} />
{/if}

<!-- Le magasin qui manque se crée ici, et devient aussitôt le rattachement de la carte. -->
<NewShopSheet
	bind:this={nouveauMagasin}
	oncreated={(shop) => {
		attach = `shop:${shop.id}`;
		avantNouveau = attach;
	}}
/>
