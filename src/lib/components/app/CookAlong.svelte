<script lang="ts">
	import { fade } from 'svelte/transition';
	import { motionMs } from '$stores/settings.svelte';
	import { i18n, t } from '$i18n/index.svelte';
	import { clampStepIndex, isFirstStep, isLastStep, nextStepIndex, previousStepIndex, speechLangOf, stepPosition } from '$domain/cook-along';
	import { Button } from '$components/ui/button';
	import { X, ChevronLeft, ChevronRight, Volume2, VolumeX } from '@lucide/svelte';
	import { ShoppingBasket } from '@lucide/svelte';
	import { tick } from 'svelte';
	import { ingredientsOfStep } from '$domain/step-ingredients';
	import type { RecipeIngredient } from '$db/schema';

	let {
		recipeName,
		steps,
		ingredients = [],
		stepIngredientIds = [],
		onClose
	}: {
		recipeName: string;
		steps: string[];
		/** The recipe's lines, and for each step the ids of those it uses (#308). */
		ingredients?: RecipeIngredient[];
		stepIngredientIds?: string[][];
		onClose: () => void;
	} = $props();

	let index = $state(0);

	let panelOpen = $state(false);
	/** The person asked to see the whole recipe rather than this step's lines. */
	let showAll = $state(false);
	let panelHeading = $state<HTMLElement | null>(null);
	let panelButton = $state<HTMLButtonElement | null>(null);

	const stepLines = $derived(ingredientsOfStep(stepIngredientIds[clampStepIndex(index, steps.length)] ?? [], ingredients));
	/** A step nobody linked falls back to the whole list, so the panel is never empty for an old recipe. */
	const hasStepLines = $derived(stepLines.length > 0);
	const shownLines = $derived(hasStepLines && !showAll ? stepLines : ingredients);

	const lineText = (line: RecipeIngredient) =>
		line.qty ? `${line.qty} ${t(`units.${line.unit}`)} ${line.name}` : line.name;

	async function openPanel() {
		panelOpen = true;
		showAll = false;
		await tick();
		panelHeading?.focus();
	}

	async function closePanel() {
		panelOpen = false;
		await tick();
		panelButton?.focus();
	}

	/** Only the lines on screen are read: short enough to follow while the hands are busy. */
	function speakIngredients() {
		speak(t('recipes.cookAlong.speakIngredients', { list: shownLines.map(lineText).join(', ') }));
	}

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
		if (event.key === 'Escape') {
			if (panelOpen) void closePanel();
			else close();
		} else if (event.key === 'ArrowRight') go(nextStepIndex(index, total));
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

	{#if ingredients.length > 0}
		<div class="flex justify-center px-6 pb-4">
			<Button
				bind:ref={panelButton}
				variant="outline"
				onclick={openPanel}
				aria-expanded={panelOpen}
				aria-controls="cook-along-ingredients"
				data-test-id="cook-along-ingredients-open"
				class="fl-press h-14 w-full max-w-md border-white/20 bg-white/10 text-white"
			>
				<ShoppingBasket size={22} aria-hidden="true" />
				{hasStepLines
					? t('recipes.cookAlong.stepIngredientsCount', { count: stepLines.length })
					: t('recipes.cookAlong.ingredients')}
			</Button>
		</div>
	{/if}

	{#if panelOpen}
		<div
			id="cook-along-ingredients"
			role="dialog"
			aria-modal="true"
			aria-labelledby="cook-along-ingredients-title"
			data-test-id="cook-along-ingredients"
			class="fixed inset-x-0 bottom-0 z-10 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-white/20 bg-neutral-900 p-5 pb-8 md:inset-x-auto md:start-1/2 md:w-[36rem] md:-translate-x-1/2 md:rounded-2xl rtl:md:translate-x-1/2"
		>
			<h2
				id="cook-along-ingredients-title"
				bind:this={panelHeading}
				tabindex="-1"
				class="text-h2 font-semibold break-words hyphens-auto outline-none"
			>
				{hasStepLines && !showAll
					? t('recipes.cookAlong.ingredientsOfStep', { current: stepPosition(index, total).current })
					: t('recipes.cookAlong.allIngredients')}
			</h2>

			{#if !hasStepLines}
				<p class="text-label mt-1 text-white/70" data-test-id="cook-along-ingredients-fallback">
					{t('recipes.cookAlong.noStepIngredients')}
				</p>
			{/if}

			<ul class="mt-4 space-y-2" data-test-id="cook-along-ingredients-list">
				{#each shownLines as line (line.id)}
					<li
						class="text-product flex items-baseline justify-between gap-3 border-b border-white/15 pb-2 last:border-0"
						data-test-class="cook-along-ingredient"
					>
						<span class="min-w-0 break-words">{line.name}</span>
						{#if line.qty}
							<span class="shrink-0 font-semibold">{line.qty} {t(`units.${line.unit}`)}</span>
						{/if}
					</li>
				{/each}
			</ul>

			<div class="mt-5 flex flex-col gap-3 sm:flex-row">
				{#if hasStepLines}
					<Button
						variant="outline"
						onclick={() => (showAll = !showAll)}
						aria-pressed={showAll}
						data-test-id="cook-along-ingredients-all"
						class="fl-press h-auto min-h-14 flex-1 py-2 whitespace-normal border-white/20 bg-white/10 text-white"
					>
						{showAll ? t('recipes.cookAlong.showStepIngredients') : t('recipes.cookAlong.showAllIngredients')}
					</Button>
				{/if}
				{#if speechAvailable}
					<Button
						variant="outline"
						onclick={speakIngredients}
						data-test-id="cook-along-ingredients-speak"
						class="fl-press h-auto min-h-14 flex-1 py-2 whitespace-normal border-white/20 bg-white/10 text-white"
					>
						<Volume2 size={22} aria-hidden="true" />
						{t('recipes.cookAlong.readIngredients')}
					</Button>
				{/if}
				<Button
					onclick={closePanel}
					data-test-id="cook-along-ingredients-close"
					class="fl-press h-auto min-h-14 flex-1 py-2 whitespace-normal"
				>
					<X size={22} aria-hidden="true" />
					{t('common.close')}
				</Button>
			</div>
		</div>
	{/if}

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
