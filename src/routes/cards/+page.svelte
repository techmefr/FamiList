<script lang="ts">
	import { flip } from 'svelte/animate';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { motionMs } from '$stores/settings.svelte';
	import { createIntent } from '$stores/create.svelte';
	import { t } from '$i18n/index.svelte';
	import { CODE_TYPES, guessCodeType, isMatrixFormat, type CodeType } from '$domain/code-format';
	import type { LoyaltyCard } from '$db/schema';
	import { linearCode } from '$domain/barcode';
	import { safeWebsiteUrl } from '$domain/website';
	import { CARD_TINTS, DEFAULT_TINT, cardBackground, tintForWhiteText } from '$domain/tint';
	import { BRANDS, findBrand } from '$domain/brand-catalogue';
	import LoyaltyCardFace from '$components/app/LoyaltyCardFace.svelte';
	import CardFullscreen from '$components/app/CardFullscreen.svelte';
	import ScanButton from '$components/app/ScanButton.svelte';
	import ImportCodeButton from '$components/app/ImportCodeButton.svelte';
	import NewShopSheet from '$components/app/NewShopSheet.svelte';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import {
		Plus,
		Trash2,
		ScanLine,
		CreditCard,
		Barcode,
		Star,
		Store,
		Pencil,
		Globe,
		Check
	} from '@lucide/svelte';
	import CardShareRequests from '$components/app/CardShareRequests.svelte';
	import IconField from '$components/app/IconField.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';

	let openCardId = $state<string | null>(null);
	let adding = $state(false);

	/** `null` means the form, when open, is creating a card. Set, it is rewriting the card of this id. */
	let editingId = $state<string | null>(null);

	/**
	 * The central button announces what it comes for. The card form stays folded until it is asked for:
	 * without that, the cursor would land on a screen with no field.
	 */
	$effect(() => {
		if (createIntent.take('card')) adding = true;
	});

	/**
	 * The card pointed at by the proximity notification opens full screen on its own.
	 *
	 * You get there with the barcode in hand, in front of the till: asking for one more tap on the right
	 * thumbnail would cancel the service rendered. The address is cleaned afterwards, so that going back
	 * does not reopen the card in a loop.
	 */
	$effect(() => {
		const requested = page.url.searchParams.get('card');
		if (!requested) return;

		if (data.cards.some((card) => card.id === requested)) openCardId = requested;
		replaceState('/cards', page.state);
	});

	let name = $state('');
	let code = $state('');
	let codeType = $state<CodeType | ''>('');
	let points = $state('0');
	let secretCode = $state('');
	let websiteUrl = $state('');
	let notes = $state('');

	/**
	 * What the card is attached to: `shop:<id>`, `brand:<brand>`, or nothing.
	 *
	 * The attachment used to be guessed by comparing the card's name to the shops', which broke at the
	 * first rename and could not express the common case — a Carrefour card works in every Carrefour, not
	 * only the one in Meximieux. So it is chosen, and the choice tells the two scopes apart.
	 */
	let attach = $state('');

	/**
	 * Creating a shop without leaving the card.
	 *
	 * You notice a shop is missing exactly here: at the moment of attaching the card. The list therefore
	 * carries a last entry opening the form in a sheet, and the created shop becomes the chosen attachment
	 * — without the typing in progress being lost.
	 *
	 * A `<select>` cannot open a dialog during its own change: we put the previous value back, then open.
	 */
	const NEW = '__new__';
	let newShop = $state<NewShopSheet | null>(null);
	let beforeNew = '';

	function surChangementRattachement(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		if (select.value !== NEW) {
			beforeNew = select.value;
			return;
		}

		attach = beforeNew;
		newShop?.show();
	}

	const openCard = $derived(data.cards.find((c) => c.id === openCardId) ?? null);

	/** The format follows what is typed until the user imposes one. */
	const effectiveType = $derived(codeType || (code.trim() ? guessCodeType(code) : 'code_39'));

	/**
	 * A format the entry cannot form is reported at entry time, not at the till: otherwise the card saves
	 * and stops being drawn on the day it is needed.
	 */
	const invalidCode = $derived(
		!isMatrixFormat(effectiveType) && code.trim() !== '' && !linearCode(code, effectiveType)
	);

	const invalidWebsite = $derived(websiteUrl.trim() !== '' && safeWebsiteUrl(websiteUrl) === null);

	const brands = $derived([
		...new Set(data.shops.map((shop) => shop.brand.trim()).filter(Boolean))
	]);

	const shop = $derived(
		attach.startsWith('shop:')
			? (data.shops.find((shop) => shop.id === attach.slice(5)) ?? null)
			: null
	);

	/** An attached shop brings its brand with it: the card is then valid for the chain. */
	const brand = $derived(
		attach.startsWith('brand:') ? attach.slice(6) : (shop?.brand.trim() ?? '')
	);

	/** The attachment names the card until it is given another name. */
	const suggestion = $derived(shop?.name ?? brand);
	const label = $derived(name.trim() || suggestion);

	/** The chain the catalogue recognises in the attachment, failing that in the name being typed. */
	const known = $derived(findBrand(brand) ?? findBrand(label));

	/**
	 * The colour suggested when none is picked: the chain's own, then the shop's, then the brand's first
	 * shop. Two cards of the same chain look alike, and that is what you are looking for at the till.
	 */
	const suggestedTint = $derived(
		known?.color ??
			shop?.tint ??
			(brand
				? (data.shops.find((shop) => shop.brand.trim() === brand)?.tint ?? DEFAULT_TINT)
				: DEFAULT_TINT)
	);

	/** Empty follows the suggestion; a palette hex is the person's own choice, kept whatever the name becomes. */
	let color = $state('');
	const tint = $derived(color || suggestedTint);

	const picked = $derived(CARD_TINTS.find((entry) => entry.hex === color) ?? null);

	/** Every catalogue name alongside the household's own brands, offered as the name is typed. */
	const nameOptions = $derived([
		...new Set([...brands, ...BRANDS.map((entry) => entry.name)])
	]);

	const swatchClass =
		'border-input has-checked:border-primary has-checked:bg-[var(--fl-primary-tint)] ' +
		'has-focus-visible:ring-ring has-focus-visible:ring-2 flex min-h-[max(2.75rem,44px)] ' +
		'cursor-pointer items-center gap-2 rounded-md border px-3 py-2';

	function reset() {
		adding = false;
		editingId = null;
		name = '';
		code = '';
		codeType = '';
		points = '0';
		secretCode = '';
		websiteUrl = '';
		notes = '';
		attach = '';
		color = '';
	}

	/**
	 * Opens the create form prefilled from an existing card, and turns its next submit into a rewrite. The
	 * same form the card was born from is what corrects it: a second editing surface would duplicate every
	 * field's rules — the code format guess, the attachment list — for no gain over this one, already tested.
	 */
	function editCard(card: LoyaltyCard) {
		editingId = card.id;
		name = card.name;
		code = card.code;
		codeType = card.codeType;
		points = String(card.points);
		secretCode = card.secretCode ?? '';
		websiteUrl = card.websiteUrl ?? '';
		notes = card.notes ?? '';
		attach = card.shopId ? `shop:${card.shopId}` : card.brand ? `brand:${card.brand}` : '';
		// Only a colour from the palette was a choice; any other came from the suggestion and follows it again.
		color = CARD_TINTS.find((entry) => entry.hex === card.tint)?.hex ?? '';
		adding = true;
		openCardId = null;
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!label || !code.trim() || invalidCode || invalidWebsite) return;

		feedback.play('add');

		const fields = {
			shopId: shop?.id ?? '',
			brand: brand,
			name: label,
			num: `•••• •••• ${code.trim().slice(-4)}`,
			code: code.trim(),
			codeType: effectiveType,
			points: Number(points) || 0,
			secretCode: secretCode.trim() || undefined,
			websiteUrl: safeWebsiteUrl(websiteUrl) ?? undefined,
			notes: notes.trim(),
			tint,
			grad: cardBackground(tint)
		};

		if (editingId) {
			data.updateCard(editingId, fields);
		} else {
			data.addCard(fields);
		}

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

	<CardShareRequests />

	{#if data.cards.length === 0}
		<EmptyState illustration="cards" text={t('cards.empty')} testId="cards-empty" />
	{:else}
		<ul class="fl-wallet mt-6" data-test-id="cards-wallet">
			{#each data.cards as card, index (card.id)}
				{@const own = data.isOwnCard(card)}
				<li
					class="fl-rise relative min-w-0"
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
						class="fl-press block h-full w-full text-start"
						data-test-class="card-open"
					>
						<LoyaltyCardFace {card} actions={own} />
					</button>
					{#if own}
					<button
						type="button"
						onclick={() => editCard(card)}
						aria-label={t('cards.edit', { name: card.name })}
						data-test-class="card-edit"
						class="fl-press absolute end-13 bottom-2 grid size-11 min-w-[44px] place-items-center text-white"
					>
						<Pencil size={18} aria-hidden="true" />
					</button>
					<button
						type="button"
						onclick={() => {
							feedback.play('remove');
							data.removeCard(card.id);
						}}
						aria-label={t('cards.delete', { name: card.name })}
						data-test-class="card-delete"
						class="fl-press absolute end-2 bottom-2 grid size-11 min-w-[44px] place-items-center text-white"
					>
						<Trash2 size={18} aria-hidden="true" />
					</button>
					{/if}
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
				The attachment first: it is what gives the name, the colour, and later the reminder on arriving at
				the shop. The choice stays optional — a library or swimming pool card attaches to nothing in the
				list.
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
						{#if brands.length > 0}
							<optgroup label={t('cards.attachBrands')}>
								{#each brands as brand (brand)}
									<option value={`brand:${brand}`}>{brand}</option>
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
						<option value={NEW}>{t('cards.attachNew')}</option>
					</select>
				</IconField>
				<p id="card-attach-hint" class="text-muted-foreground text-caption">
					{t('cards.attachHint')}
				</p>
			</div>

			<!--
				The name is no longer required: the attachment gives it, and it shows as a placeholder so you can see
				what will be used. You only fill it in to tell two cards of the same shop apart — the mother's and
				the father's.
			-->
			<div>
				<Label for="card-name">{t('cards.name')}</Label>
				<IconField icon={CreditCard}>
					<Input
						id="card-name"
						bind:value={name}
						data-test-id="card-name"
						list="card-name-brands"
						autocomplete="off"
						required={!suggestion}
						placeholder={suggestion || t('cards.namePlaceholder')}
					/>
				</IconField>
				<datalist id="card-name-brands">
					{#each nameOptions as option (option)}
						<option value={option}></option>
					{/each}
				</datalist>
				{#if known}
					<p
						class="text-muted-foreground text-caption mt-1"
						role="status"
						data-test-id="card-brand-match"
					>
						{t('cards.brandMatch', { brand: known.name })}
					</p>
				{/if}
			</div>

			<!--
				The colour is offered by name as much as by swatch, so the choice never rests on telling two hues
				apart. "Automatic" follows the chain the name or the attachment points at; every other entry is
				already dark enough to carry the white name.
			-->
			<fieldset>
				<legend class="text-label mb-2 font-medium">{t('cards.color')}</legend>
				<div class="flex flex-wrap gap-2" data-test-id="card-color-list">
					<Label class={swatchClass}>
						<input
							type="radio"
							name="card-color"
							value=""
							bind:group={color}
							data-test-id="card-color-auto"
							class="sr-only"
						/>
						<span
							class="grid size-6 shrink-0 place-items-center rounded-full"
							style="background: {tintForWhiteText(suggestedTint)}"
							aria-hidden="true"
						>
							{#if !color}<Check size={14} color="#fff" />{/if}
						</span>
						{known ? t('cards.colorBrand', { brand: known.name }) : t('cards.colorAuto')}
					</Label>
					{#each CARD_TINTS as entry (entry.id)}
						<Label class={swatchClass}>
							<input
								type="radio"
								name="card-color"
								value={entry.hex}
								bind:group={color}
								data-test-id="card-color-{entry.id}"
								class="sr-only"
							/>
							<span
								class="grid size-6 shrink-0 place-items-center rounded-full"
								style="background: {entry.hex}"
								aria-hidden="true"
							>
								{#if picked?.id === entry.id}<Check size={14} color="#fff" />{/if}
							</span>
							{t(`cards.colors.${entry.id}`)}
						</Label>
					{/each}
				</div>
			</fieldset>

			<div>
				<p class="text-label mb-2 font-medium">{t('cards.preview')}</p>
				<div class="max-w-xs" data-test-id="card-preview">
					<LoyaltyCardFace
						card={{
							name: label || t('cards.namePlaceholder'),
							brand: known?.name ?? brand,
							num: code.trim() ? `•••• •••• ${code.trim().slice(-4)}` : '•••• •••• ••••',
							tint,
							codeType: effectiveType,
							notes
						}}
					/>
				</div>
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
					Two paths to the same code: the camera, and an image already on the device. The second is not a
					fallback — it is the normal path when you register your cards sitting in front of a computer, the
					card being in an email or in an old photo.
				-->
				<ScanButton
					onScanned={(result) => {
						code = result.value;
						if (result.codeType) codeType = result.codeType;
					}}
				>
					{#snippet photo()}
						<ImportCodeButton
							mode="photo"
							onScanned={(result) => {
								code = result.value;
								if (result.codeType) codeType = result.codeType;
							}}
						/>
					{/snippet}
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

			<div>
				<Label for="card-secret-code">{t('cards.secretCode')}</Label>
				<IconField icon={Barcode}>
					<Input
						id="card-secret-code"
						bind:value={secretCode}
						data-test-id="card-secret-code"
						placeholder={t('cards.secretCodePlaceholder')}
					/>
				</IconField>
				<p class="text-muted-foreground text-caption mt-1">{t('cards.secretCodeHint')}</p>
			</div>

			<div>
				<Label for="card-website">{t('cards.websiteUrl')}</Label>
				<IconField icon={Globe}>
					<Input
						id="card-website"
						inputmode="url"
						autocomplete="url"
						bind:value={websiteUrl}
						data-test-id="card-website"
						placeholder={t('cards.websiteUrlPlaceholder')}
						aria-invalid={invalidWebsite}
					/>
				</IconField>
				{#if invalidWebsite}
					<p class="text-destructive text-caption mt-1" role="alert" data-test-id="card-website-error">
						{t('cards.websiteUrlInvalid')}
					</p>
				{/if}
			</div>

			<!--
				The note is typed from creation onwards: what you have to write — the card's secret code, the
				threshold where points can be spent — is in front of you at the moment you save the card, not later.
				Forcing it through the full-screen view amounted to never writing it.
			-->
			<div>
				<Label for="card-notes">{t('cards.notes')}</Label>
				<textarea
					id="card-notes"
					bind:value={notes}
					rows="3"
					data-test-id="card-notes-input"
					placeholder={t('cards.notesPlaceholder')}
					class="border-input bg-background w-full rounded-md border p-3"
				></textarea>
			</div>

			<div class="flex flex-wrap gap-2">
				<Button type="submit" data-test-id="card-submit" class="fl-press">
					{editingId ? t('common.save') : t('cards.save')}
				</Button>
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
	<CardFullscreen card={openCard} onClose={() => (openCardId = null)} onEdit={editCard} />
{/if}

<!-- The missing shop is created here, and immediately becomes the card's attachment. -->
<NewShopSheet
	bind:this={newShop}
	oncreated={(shop) => {
		attach = `shop:${shop.id}`;
		beforeNew = attach;
	}}
/>
