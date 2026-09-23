<script lang="ts">
	import { fade } from 'svelte/transition';
	import { motionMs } from '$stores/settings.svelte';
	import { i18n, t } from '$i18n/index.svelte';
	import { clampStepIndex, isFirstStep, isLastStep, nextStepIndex, previousStepIndex, speechLangOf, stepPosition } from '$domain/cook-along';
	import { Button } from '$components/ui/button';
	import { X, ChevronLeft, ChevronRight, Volume2, VolumeX } from '@lucide/svelte';

	let {
		recipeName,
		steps,
		onClose
	}: { recipeName: string; steps: string[]; onClose: () => void } = $props();

	let index = $state(0);

	/**
	 * `null` until we know: `SpeechSynthesis` is missing on some browsers (older Safari, some embedded
	 * webviews), and probing it once at mount rather than on every click keeps the speak button from
	 * flickering between two states.
	 */
	const speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;

	let speaking = $state(false);
	/** Muted is a choice the person makes; it stays true until they turn it back on, across steps. */
	let muted = $state(false);

	const total = $derived(steps.length);
	const current = $derived(steps[clampStepIndex(index, total)] ?? '');
	const position = $derived(stepPosition(index, total));
	const atFirst = $derived(isFirstStep(index, total));
	const atLast = $derived(isLastStep(index, total));

	function stop() {
		if (speechAvailable) window.speechSynthesis.cancel();
		speaking = false;
	}

	function speak(text: string) {
		if (!speechAvailable || muted || !text.trim()) return;

		window.speechSynthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = speechLangOf(i18n.locale);
		utterance.onend = () => (speaking = false);
		utterance.onerror = () => (speaking = false);
		speaking = true;
		window.speechSynthesis.speak(utterance);
	}

	function toggleMute() {
		muted = !muted;
		if (muted) stop();
		else speak(current);
	}

	function go(to: number) {
		index = clampStepIndex(to, total);
		speak(current);
	}

	$effect(() => {
		// Reads the first step out loud as soon as the mode opens, the same way a person cooking with you
		// would start by telling you what to do first rather than waiting to be asked.
		speak(steps[clampStepIndex(0, steps.length)] ?? '');
		return stop;
	});

	function close() {
		stop();
		onClose();
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') close();
		else if (event.key === 'ArrowRight') go(nextStepIndex(index, total));
		else if (event.key === 'ArrowLeft') go(previousStepIndex(index, total));
	}}
/>

<div
	transition:fade={{ duration: motionMs(180) }}
	class="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-black text-white"
	role="dialog"
	aria-modal="true"
	aria-label={t('recipes.cookAlong.title', { name: recipeName })}
	data-test-id="cook-along"
>
	<div class="flex items-center gap-3 px-4 pt-6 pb-2">
		<button
			type="button"
			onclick={close}
			aria-label={t('common.close')}
			data-test-id="cook-along-close"
			class="grid size-11 min-w-[44px] shrink-0 place-items-center rounded-full border border-white/20 bg-white/10"
		>
			<X size={20} aria-hidden="true" />
		</button>
		<p class="text-product flex-1 text-center font-semibold break-words">{recipeName}</p>

		{#if speechAvailable}
			<button
				type="button"
				onclick={toggleMute}
				aria-label={t(muted ? 'recipes.cookAlong.unmute' : 'recipes.cookAlong.mute')}
				aria-pressed={!muted}
				data-test-id="cook-along-mute"
				class="grid size-11 min-w-[44px] shrink-0 place-items-center rounded-full border border-white/20 bg-white/10"
			>
				{#if muted}
					<VolumeX size={20} aria-hidden="true" />
				{:else}
					<Volume2 size={20} aria-hidden="true" />
				{/if}
			</button>
		{:else}
			<span class="size-11 min-w-[44px] shrink-0"></span>
		{/if}
	</div>

	<p class="text-caption text-center text-white/60" data-test-id="cook-along-position">
		{t('recipes.cookAlong.position', { current: position.current, total: position.total })}
	</p>

	<div class="flex flex-1 items-center justify-center px-6 py-8">
		{#if total > 0}
			<p
				data-test-id="cook-along-step"
				class="text-center text-3xl leading-snug font-semibold break-words"
			>
				{current}
			</p>
		{:else}
			<p class="text-center text-white/70">{t('recipes.cookAlong.empty')}</p>
		{/if}
	</div>

	<div class="flex items-center justify-center gap-4 px-6 pb-10">
		<Button
			variant="outline"
			disabled={atFirst}
			onclick={() => go(previousStepIndex(index, total))}
			aria-label={t('recipes.cookAlong.previous')}
			data-test-id="cook-along-previous"
			class="fl-press h-14 flex-1 border-white/20 bg-white/10 text-white"
		>
			<ChevronLeft size={22} aria-hidden="true" />
			{t('recipes.cookAlong.previous')}
		</Button>

		<Button
			disabled={atLast}
			onclick={() => go(nextStepIndex(index, total))}
			data-test-id="cook-along-next"
			class="fl-press h-14 flex-1"
		>
			{t('recipes.cookAlong.next')}
			<ChevronRight size={22} aria-hidden="true" />
		</Button>
	</div>
</div>
