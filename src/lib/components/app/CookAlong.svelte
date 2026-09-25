<script lang="ts">
	import { fade } from 'svelte/transition';
	import { motionMs } from '$stores/settings.svelte';
	import { i18n, t } from '$i18n/index.svelte';
	import {
		clampStepIndex,
		isFirstStep,
		isLastStep,
		nextStepIndex,
		previousStepIndex,
		progressPercent,
		speechLangOf,
		stepPosition,
		stepTrack
	} from '$domain/cook-along';
	import { Button } from '$components/ui/button';
	import { X, Check, ChevronLeft, ChevronRight, Volume2, VolumeX } from '@lucide/svelte';

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
	const track = $derived(stepTrack(index, total));
	const percent = $derived(progressPercent(index, total));

	let trackList = $state<HTMLOListElement | null>(null);

	/**
	 * A long recipe scrolls its track: the current step is brought back to its centre. The track alone is
	 * scrolled — `scrollIntoView` would also shift the page behind the dialog, which a right-to-left page
	 * does visibly.
	 */
	$effect(() => {
		void index;
		const currentStep = trackList?.querySelector<HTMLElement>('[aria-current="step"]');
		if (!trackList || !currentStep) return;

		const track = trackList.getBoundingClientRect();
		const step = currentStep.getBoundingClientRect();
		trackList.scrollBy({
			left: step.left + step.width / 2 - (track.left + track.width / 2),
			behavior: motionMs(1) > 0 ? 'smooth' : 'auto'
		});
	});

	/** In a right-to-left language the next step sits on the left, so the arrow keys follow it. */
	function isRtl(): boolean {
		return typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
	}

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
		const forward = isRtl() ? 'ArrowLeft' : 'ArrowRight';
		const back = isRtl() ? 'ArrowRight' : 'ArrowLeft';

		if (event.key === 'Escape') close();
		else if (event.key === forward || event.key === back) {
			// The page behind the dialog would otherwise scroll sideways along with the step.
			event.preventDefault();
			go(event.key === forward ? nextStepIndex(index, total) : previousStepIndex(index, total));
		}
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
		<p class="text-product min-w-0 flex-1 text-center font-semibold break-words">{recipeName}</p>

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

	<nav aria-label={t('recipes.cookAlong.steps')} class="px-4 pt-2">
		<p
			class="text-product text-center font-semibold"
			aria-live="polite"
			aria-atomic="true"
			data-test-id="cook-along-position"
		>
			{t('recipes.cookAlong.position', { current: position.current, total: position.total })}
		</p>

		{#if total > 1}
			<div class="mx-auto mt-3 h-2 max-w-xl overflow-hidden rounded-full bg-white/15" aria-hidden="true">
				<div
					class="bg-primary h-full rounded-full transition-[width] motion-reduce:transition-none"
					style:width="{percent}%"
				></div>
			</div>

			<ol
				bind:this={trackList}
				class="mx-auto mt-3 flex w-fit max-w-full gap-2 overflow-x-auto px-1 py-2"
				data-test-id="cook-along-track"
			>
				{#each track as step (step.number)}
					<li class="shrink-0">
						<button
							type="button"
							onclick={() => go(step.number - 1)}
							aria-current={step.state === 'current' ? 'step' : undefined}
							aria-label={t('recipes.cookAlong.goTo', { current: step.number, total })}
							data-test-class="cook-along-track-step"
							data-state={step.state}
							class="fl-press relative grid aspect-square size-[clamp(56px,3.5rem,80px)] place-items-center rounded-full text-lg font-bold
								{step.state === 'current'
								? 'border-4 border-white bg-white text-black'
								: step.state === 'done'
									? 'border-2 border-white/60 bg-white/15 text-white'
									: 'border-2 border-dashed border-white/40 text-white/80'}"
						>
							{step.number}
							{#if step.state === 'done'}
								<span
									class="bg-secondary absolute -end-0.5 -top-0.5 grid size-[clamp(20px,1.25rem,28px)] place-items-center rounded-full text-white"
									aria-hidden="true"
								>
									<Check size={14} strokeWidth={3} />
								</span>
							{/if}
						</button>
					</li>
				{/each}
			</ol>
		{/if}
	</nav>

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
			<ChevronLeft size={22} aria-hidden="true" class="rtl:rotate-180" />
			{t('recipes.cookAlong.previous')}
		</Button>

		<Button
			disabled={atLast}
			onclick={() => go(nextStepIndex(index, total))}
			data-test-id="cook-along-next"
			class="fl-press h-14 flex-1"
		>
			{t('recipes.cookAlong.next')}
			<ChevronRight size={22} aria-hidden="true" class="rtl:rotate-180" />
		</Button>
	</div>
</div>
