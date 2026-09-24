<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { LoyaltyCard } from '$db/schema';
	import { data } from '$stores/data.svelte';
	import { motionMs } from '$stores/settings.svelte';
	import { t } from '$i18n/index.svelte';
	import CodeImage from './CodeImage.svelte';
	import CardShareSheet from './CardShareSheet.svelte';
	import { Button } from '$components/ui/button';
	import { readCardAccount, type CardAccount } from '$stores/card-account';
	import { safeWebsiteUrl } from '$domain/website';
	import { X, Sun, Pencil, Eye, EyeOff, Share2, KeyRound, ExternalLink } from '@lucide/svelte';

	let {
		card,
		onClose,
		onEdit
	}: { card: LoyaltyCard; onClose: () => void; onEdit: (card: LoyaltyCard) => void } = $props();

	/**
	 * `null` means "not editing". Starting again from the card at every opening of the editor stops a draft
	 * from staying stuck to a card changed in the meantime on another device.
	 */
	let draft = $state<string | null>(null);

	function save() {
		if (draft !== null) data.updateCard(card.id, { notes: draft.trim() });
		draft = null;
	}

	/** Which half of the screen is showing. Always starts on the card: that is what a checkout is for. */
	let tab = $state<'card' | 'account'>('card');

	const owned = $derived(data.isOwnCard(card));
	const website = $derived(safeWebsiteUrl(card.websiteUrl));

	let shareSheet = $state<CardShareSheet | null>(null);

	let account = $state<CardAccount | null>(null);
	let accountState = $state<'loading' | 'ready' | 'error'>('loading');
	let accountError = $state('');

	async function openAccountTab() {
		tab = 'account';
		accountState = 'loading';
		const result = await readCardAccount(card.id);
		if (result.ok) account = result.value;
		else accountError = result.error;
		accountState = result.ok ? 'ready' : 'error';
	}

	let detail = $state<'notes' | 'codes'>('notes');

	/**
	 * Only the secret code is masked, never the barcode: the barcode is what the till scans, and a
	 * glance over the shoulder at the PIN is what the mask guards against.
	 */
	let revealed = $state(false);
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') onClose();
	}}
/>

<!--
	The black ground fades in, the code rises: it is the gesture of a card being taken out of a wallet.
	Scaling the whole screen would carry no risk here — nothing overlaps this layer — but the barcode must be
	sharp straight away.
-->
<div
	transition:fade={{ duration: motionMs(180) }}
	class="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-black"
	role="dialog"
	aria-modal="true"
	aria-label={card.name}
	data-test-id="card-fullscreen"
>
	<div class="flex items-center gap-3 px-4 pt-6 pb-2 text-white">
		<button
			type="button"
			onclick={onClose}
			aria-label={t('common.close')}
			data-test-id="card-close"
			class="grid size-11 min-w-[44px] shrink-0 place-items-center rounded-full border border-white/20 bg-white/10"
		>
			<X size={20} aria-hidden="true" />
		</button>
		<p class="text-product flex-1 text-center font-semibold break-words">{card.name}</p>
		{#if owned}
			<button
				type="button"
				onclick={() => shareSheet?.show()}
				aria-label={t('cards.share', { name: card.name })}
				data-test-id="card-share"
				class="grid size-11 min-w-[44px] shrink-0 place-items-center rounded-full border border-white/20 bg-white/10"
			>
				<Share2 size={20} aria-hidden="true" />
			</button>
			<button
				type="button"
				onclick={() => onEdit(card)}
				aria-label={t('cards.edit', { name: card.name })}
				data-test-id="card-edit"
				class="grid size-11 min-w-[44px] shrink-0 place-items-center rounded-full border border-white/20 bg-white/10"
			>
				<Pencil size={20} aria-hidden="true" />
			</button>
		{/if}
	</div>

	<div class="px-5 pb-10">
		<div class="mb-5 flex gap-2 rounded-full bg-white/10 p-1" role="tablist">
			<button
				type="button"
				role="tab"
				aria-selected={tab === 'card'}
				onclick={() => (tab = 'card')}
				data-test-id="card-tab-card"
				class="fl-press text-label flex-1 rounded-full py-2 font-medium {tab === 'card'
					? 'bg-white text-neutral-900'
					: 'text-white/70'}"
			>
				{t('cards.tabCard')}
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={tab === 'account'}
				onclick={openAccountTab}
				data-test-id="card-tab-account"
				class="fl-press text-label flex-1 rounded-full py-2 font-medium {tab === 'account'
					? 'bg-white text-neutral-900'
					: 'text-white/70'}"
			>
				{t('cards.tabAccount')}
			</button>
		</div>

		{#if tab === 'card'}
			<div class="fl-rise rounded-lg bg-white p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
				<p class="text-caption text-center font-bold tracking-widest text-neutral-900">
					{t('cards.showAtCheckout')}
				</p>

				<div class="my-5 flex justify-center">
					<CodeImage value={card.code || card.num} codeType={card.codeType} />
				</div>

				<p
					class="text-label text-center font-mono tracking-widest break-all text-neutral-900"
					data-test-id="card-code-value"
				>
					{card.code || card.num}
				</p>
				<p
					class="text-caption mt-2 text-center font-semibold text-neutral-500"
					data-test-id="card-code-type"
					data-test-state={card.codeType}
				>
					{t(`cards.type.${card.codeType}`)}
				</p>
			</div>

			<p class="text-caption mt-4 flex items-center justify-center gap-2 text-white/65">
				<Sun size={16} aria-hidden="true" />
				{t('cards.brightnessHint')}
			</p>

			<div class="mt-5 flex gap-2 rounded-full bg-white/10 p-1" role="tablist">
				<button
					type="button"
					role="tab"
					aria-selected={detail === 'notes'}
					onclick={() => (detail = 'notes')}
					data-test-id="card-detail-notes"
					class="fl-press text-label min-h-[44px] flex-1 rounded-full py-2 font-medium {detail === 'notes'
						? 'bg-white text-neutral-900'
						: 'text-white/70'}"
				>
					{t('cards.notes')}
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={detail === 'codes'}
					onclick={() => (detail = 'codes')}
					data-test-id="card-detail-codes"
					class="fl-press text-label min-h-[44px] flex-1 rounded-full py-2 font-medium {detail === 'codes'
						? 'bg-white text-neutral-900'
						: 'text-white/70'}"
				>
					{t('cards.tabCodes')}
				</button>
			</div>

			{#if detail === 'notes'}
				<section class="mt-3 rounded-lg border border-white/15 bg-white/5 p-4">
					{#if owned}
						<div class="mb-3 flex justify-end">
							<Button
								variant={draft === null ? 'outline' : 'default'}
								onclick={() => (draft === null ? (draft = card.notes ?? '') : save())}
								data-test-id="card-notes-toggle"
							>
								{draft === null ? t('common.edit') : t('common.save')}
							</Button>
						</div>
					{/if}

					{#if draft !== null}
						<textarea
							bind:value={draft}
							rows="3"
							placeholder={t('cards.notesPlaceholder')}
							data-test-id="card-notes"
							class="w-full rounded-md border border-white/20 bg-black/40 p-3 text-white"
						></textarea>
					{:else}
						<p class="text-white/85" data-test-id="card-notes-text">
							{card.notes || t('cards.noNotes')}
						</p>
					{/if}
				</section>
			{:else}
				<section
					class="mt-3 rounded-lg border border-white/15 bg-white/5 p-4 text-center text-white"
					data-test-id="card-codes"
				>
					<p class="text-caption font-medium text-white/60">{t('cards.secretCode')}</p>
					{#if !card.secretCode}
						<p class="text-white/85 mt-2" data-test-id="card-secret-code-empty">{t('cards.noSecretCode')}</p>
					{:else if revealed}
						<p
							class="text-label mt-2 font-mono tracking-widest"
							data-test-id="card-secret-code-value"
						>
							{card.secretCode}
						</p>
						<button
							type="button"
							onclick={() => (revealed = false)}
							data-test-id="card-code-hide"
							class="fl-press text-label mx-auto mt-3 flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-white/70"
						>
							<EyeOff size={18} aria-hidden="true" />
							{t('cards.hideCode')}
						</button>
					{:else}
						<p class="text-label mt-2 font-mono tracking-widest text-white/40" aria-hidden="true">••••••</p>
						<button
							type="button"
							onclick={() => (revealed = true)}
							data-test-id="card-code-reveal"
							class="fl-press bg-primary text-primary-foreground text-label mx-auto mt-3 flex min-h-[max(2.75rem,44px)] items-center gap-2 rounded-full px-6 font-medium"
						>
							<Eye size={18} aria-hidden="true" />
							{t('cards.revealCode')}
						</button>
					{/if}
				</section>
			{/if}
		{:else}
			<section
				class="rounded-lg border border-white/15 bg-white/5 p-4 text-white"
				data-test-id="card-account"
			>
				{#if accountState === 'loading'}
					<p class="text-white/70">{t('common.loading')}</p>
				{:else if accountState === 'error'}
					<p class="text-white/85" role="alert" data-test-id="card-account-error">
						{t('cards.accountError', { error: accountError })}
					</p>
				{:else if account && (account.email || account.hasPassword)}
					{#if account.email}
						<p class="text-caption text-white/60">{t('cards.accountEmail')}</p>
						<p class="text-label break-all" data-test-id="card-account-email">{account.email}</p>
					{/if}
					<p class="text-caption mt-3 text-white/60">
						{account.hasPassword ? t('cards.accountPasswordSaved') : t('cards.accountNoPassword')}
					</p>
				{:else}
					<p class="text-white/85" data-test-id="card-account-empty">{t('cards.accountEmpty')}</p>
				{/if}

				{#if owned || account?.hasPassword || accountState === 'error'}
					<a
						href={`/cards/${card.id}/account`}
						data-test-id="card-account-open"
						class="fl-press bg-primary text-primary-foreground text-label mt-4 flex min-h-[max(2.75rem,44px)] items-center justify-center gap-2 rounded-full px-6 font-medium"
					>
						<KeyRound size={18} aria-hidden="true" />
						{t('cards.accountOpen')}
					</a>
				{/if}
				{#if website}
					<a
						href={website}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={t('cards.websiteOpenLabel', { name: card.name })}
						data-test-id="card-website-open"
						class="fl-press text-label mt-3 flex min-h-[max(2.75rem,44px)] items-center justify-center gap-2 rounded-full border border-white/30 px-6 font-medium text-white"
					>
						<ExternalLink size={18} aria-hidden="true" />
						{t('cards.websiteOpen')}
					</a>
				{/if}
				<p class="text-caption mt-3 text-white/50">{t('cards.accountSecureHint')}</p>
				{#if !owned}
					<p class="text-caption mt-2 text-white/50">{t('cards.accountReadOnly')}</p>
				{/if}
			</section>
		{/if}
	</div>
</div>

{#if owned}
	<CardShareSheet bind:this={shareSheet} {card} />
{/if}
