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
	 * `null` signifie « pas en train d'éditer ». Repartir de la carte à chaque ouverture de l'édition
	 * évite qu'un brouillon reste collé à une carte modifiée entre-temps sur un autre appareil.
	 */
	let draft = $state<string | null>(null);

	function save() {
		if (draft !== null) data.updateCard(card.id, { notes: draft.trim() });
		draft = null;
	}

	/**
	 * Plein écran sur fond noir avec un code très contrasté : c'est ce qui se lit le plus vite sous
	 * une douchette de caisse, et ce que l'utilisateur cherche quand il ouvre une carte.
	 */
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') onClose();
	}}
/>

<!--
	Le fond noir se fond, le code monte : c'est le geste d'une carte qu'on sort du portefeuille. Une
	mise à l'échelle de tout l'écran serait ici sans risque — rien ne se superpose à ce calque — mais
	le code-barres, lui, doit être net tout de suite.
-->
<div
	transition:fade={{ duration: motionMs(180) }}
	class="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-black"
	role="dialog"
	aria-modal="true"
	aria-label={card.name}
	data-test="card-fullscreen"
>
	<div class="flex items-center gap-3 px-4 pt-6 pb-2 text-white">
		<button
			type="button"
			onclick={onClose}
			aria-label={t('common.close')}
			data-test="card-close"
			class="grid size-11 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10"
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
					data-test="card-notes-toggle"
				>
					{draft === null ? t('common.edit') : t('common.save')}
				</Button>
			</div>

			{#if draft !== null}
				<textarea
					bind:value={draft}
					rows="3"
					placeholder={t('cards.notesPlaceholder')}
					data-test="card-notes"
					class="w-full rounded-md border border-white/20 bg-black/40 p-3 text-white"
				></textarea>
			{:else}
				<p class="text-white/85" data-test="card-notes-text">
					{card.notes || t('cards.noNotes')}
				</p>
			{/if}

			<p class="text-caption mt-4 text-white/50">{t('cards.secretNotice')}</p>
		</section>
	</div>
</div>
