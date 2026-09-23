<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { LoyaltyCard } from '$db/schema';
	import { data } from '$stores/data.svelte';
	import { motionMs } from '$stores/settings.svelte';
	import { t } from '$i18n/index.svelte';
	import CodeImage from './CodeImage.svelte';
	import { Button } from '$components/ui/button';
	import { X, Sun, Pencil, Eye, EyeOff } from '@lucide/svelte';

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

	/** Which half of the screen is showing. Always starts on the code: that is what a checkout is for. */
	let tab = $state<'code' | 'notes'>('code');

	/**
	 * The code stays masked until asked for, on every opening — including on a device that never leaves the
	 * owner's hand. A glance over the shoulder at a till, or a screen left unlocked, must not hand over a
	 * loyalty account for free.
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
		<button
			type="button"
			onclick={() => onEdit(card)}
			aria-label={t('cards.edit', { name: card.name })}
			data-test-id="card-edit"
			class="grid size-11 min-w-[44px] shrink-0 place-items-center rounded-full border border-white/20 bg-white/10"
		>
			<Pencil size={20} aria-hidden="true" />
		</button>
	</div>

	<div class="px-5 pb-10">
		<div class="mb-5 flex gap-2 rounded-full bg-white/10 p-1" role="tablist">
			<button
				type="button"
				role="tab"
				aria-selected={tab === 'code'}
				onclick={() => (tab = 'code')}
				data-test-id="card-tab-code"
				class="fl-press text-label flex-1 rounded-full py-2 font-medium {tab === 'code'
					? 'bg-white text-neutral-900'
					: 'text-white/70'}"
			>
				{t('cards.tabCode')}
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={tab === 'notes'}
				onclick={() => (tab = 'notes')}
				data-test-id="card-tab-notes"
				class="fl-press text-label flex-1 rounded-full py-2 font-medium {tab === 'notes'
					? 'bg-white text-neutral-900'
					: 'text-white/70'}"
			>
				{t('cards.tabNotes')}
			</button>
		</div>

		{#if tab === 'code'}
			<div class="fl-rise rounded-lg bg-white p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
				{#if revealed}
					<p class="text-caption text-center font-bold tracking-widest text-neutral-900">
						{t('cards.showAtCheckout')}
					</p>

					<div class="my-5 flex justify-center">
						<CodeImage value={card.code || card.num} codeType={card.codeType} />
					</div>

					<p class="text-label text-center font-mono tracking-widest break-all text-neutral-900">
						{card.code || card.num}
					</p>
					<p class="text-caption mt-2 text-center font-semibold text-neutral-500">
						{t(`cards.type.${card.codeType}`)}
					</p>

					<button
						type="button"
						onclick={() => (revealed = false)}
						data-test-id="card-code-hide"
						class="fl-press text-label mx-auto mt-4 flex items-center gap-2 rounded-full px-4 py-2 text-neutral-500"
					>
						<EyeOff size={18} aria-hidden="true" />
						{t('cards.hideCode')}
					</button>
				{:else}
					<p class="text-label text-center font-mono tracking-widest text-neutral-300" aria-hidden="true">
						••••••••••••
					</p>
					<button
						type="button"
						onclick={() => (revealed = true)}
						data-test-id="card-code-reveal"
						class="fl-press bg-primary text-primary-foreground text-label mx-auto mt-4 flex min-h-[max(2.75rem,44px)] items-center gap-2 rounded-full px-6 font-medium"
					>
						<Eye size={18} aria-hidden="true" />
						{t('cards.revealCode')}
					</button>
					<p class="text-caption mt-3 text-center text-neutral-500">{t('cards.codeMaskedHint')}</p>
				{/if}
			</div>

			{#if revealed}
				<p class="text-caption mt-4 flex items-center justify-center gap-2 text-white/65">
					<Sun size={16} aria-hidden="true" />
					{t('cards.brightnessHint')}
				</p>
			{/if}
		{:else}
			<section class="rounded-lg border border-white/15 bg-white/5 p-4">
				<div class="mb-3 flex items-center justify-between gap-3">
					<h2 class="text-product font-semibold text-white">{t('cards.notes')}</h2>
					<Button
						variant={draft === null ? 'outline' : 'default'}
						onclick={() => (draft === null ? (draft = card.notes ?? '') : save())}
						data-test-id="card-notes-toggle"
					>
						{draft === null ? t('common.edit') : t('common.save')}
					</Button>
				</div>

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

				<p class="text-caption mt-4 text-white/50">{t('cards.secretNotice')}</p>
			</section>
		{/if}
	</div>
</div>
