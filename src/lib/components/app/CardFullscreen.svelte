<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { LoyaltyCard } from '$db/schema';
	import { data } from '$stores/data.svelte';
	import { motionMs } from '$stores/settings.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import CodeImage from './CodeImage.svelte';
	import { Button } from '$lib/components/ui/button';
	import { X, Sun } from '@lucide/svelte';

	let { card, onClose }: { card: LoyaltyCard; onClose: () => void } = $props();

	/**
	 * `null` means "not editing". Starting again from the card at every opening of the editor stops a draft
	 * from staying stuck to a card changed in the meantime on another device.
	 */
	let draft = $state<string | null>(null);

	function save() {
		if (draft !== null) data.updateCard(card.id, { notes: draft.trim() });
		draft = null;
	}

	/**
	 * Full screen on a black ground with a very contrasted code: that is what reads fastest under a till
	 * scanner, and what the user is looking for when they open a card.
	 */
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
		<span class="size-11 shrink-0" aria-hidden="true"></span>
	</div>

	<div class="px-5 pb-10">
		<div class="fl-rise rounded-lg bg-white p-5 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
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
		</div>

		<p class="text-caption mt-4 flex items-center justify-center gap-2 text-white/65">
			<Sun size={16} aria-hidden="true" />
			{t('cards.brightnessHint')}
		</p>

		<section class="mt-6 rounded-lg border border-white/15 bg-white/5 p-4">
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
	</div>
</div>
