<script lang="ts">
	import { tick } from 'svelte';
	import { goto, pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { ai } from '$stores/ai.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { recipeDraft } from '$stores/recipe-draft.svelte';
	import { t } from '$i18n/index.svelte';
	import type { RecipeDraft } from '$domain/recipe-draft';
	import { RECIPE_SOURCES, type RecipeSource } from '$components/app/recipe-sources';
	import { Button } from '$components/ui/button';
	import { ChevronLeft, KeyRound } from '@lucide/svelte';

	/**
	 * The open source lives in the history entry and not in a local variable: the phone's Back gesture then
	 * returns to the tiles, as the person expects, instead of leaving the screen altogether.
	 */
	const active = $derived(RECIPE_SOURCES.find((source) => source.id === page.state.recipeSource) ?? null);

	let heading = $state<HTMLHeadingElement | null>(null);

	const locked = (source: RecipeSource) => source.requiresAi && !ai.configured;

	/** Every source ends here: the draft goes to the recipe form, which is the only place that saves. */
	async function useDraft(draft: RecipeDraft) {
		recipeDraft.offer(draft);
		await goto('/recipes', { replaceState: Boolean(active) });
	}

	async function choose(source: RecipeSource) {
		feedback.play('tap');

		if ('start' in source && !locked(source)) {
			await useDraft(source.start());
			return;
		}

		pushState('', { recipeSource: source.id });
		await tick();
		heading?.focus();
	}
</script>

<!--
	"Create a recipe" (#311): every way of starting one, as a column of large labelled tiles.

	One tile per line on a phone and not a grid of small squares: at the largest text size a two-column grid
	cut the descriptions to a word per line, and a full-width tile falls under the thumb of either hand
	whatever the handedness setting. Wider screens get two columns, where there is room for both.
-->
<svelte:head>
	<title>{t('recipes.create.title')} — {t('app.name')}</title>
</svelte:head>

{#if active}
	<Button variant="outline" onclick={() => history.back()} data-test-id="recipe-source-back" class="fl-press">
		<ChevronLeft size={18} aria-hidden="true" class="rtl:rotate-180" />
		{t('recipes.create.back')}
	</Button>

	<h1
		bind:this={heading}
		tabindex="-1"
		class="text-h1 mt-4 font-semibold outline-none"
		data-test-id="recipe-source-title"
	>
		{t(`recipes.create.sources.${active.id}.title`)}
	</h1>

	<div class="mt-4" data-test-id="recipe-source-panel">
		{#if locked(active)}
			<div class="bg-card space-y-3 rounded-xl border p-4" data-test-id="recipe-source-needs-key">
				<p class="text-label flex items-center gap-2 font-semibold">
					<KeyRound size={18} aria-hidden="true" />
					{t('recipes.create.needsKey')}
				</p>
				<p class="text-label">{t('recipes.create.needsKeyBody')}</p>
				<Button href="/profile/ai" data-test-id="recipe-source-set-key" class="fl-press">
					{t('recipes.create.needsKeyLink')}
				</Button>
			</div>
		{:else if 'panel' in active}
			{@const Panel = active.panel}
			<Panel onDraft={useDraft} />
		{/if}
	</div>
{:else}
	<a
		href="/recipes"
		data-test-id="recipe-create-to-recipes"
		class="text-accent-foreground text-label inline-flex min-h-[max(2.75rem,44px)] items-center gap-1 font-medium"
	>
		<ChevronLeft size={18} aria-hidden="true" class="rtl:rotate-180" />
		{t('recipes.create.backToRecipes')}
	</a>

	<h1 class="text-h1 mt-2 font-semibold">{t('recipes.create.title')}</h1>
	<p class="text-muted-foreground text-label mt-1">{t('recipes.create.intro')}</p>

	<ul class="mt-4 grid gap-3 md:grid-cols-2" data-test-id="recipe-sources">
		{#each RECIPE_SOURCES as source (source.id)}
			{@const Icon = source.icon}
			<li>
				<button
					type="button"
					onclick={() => choose(source)}
					data-test-id="recipe-source-{source.id}"
					data-test-state={locked(source) ? 'needs-key' : 'ready'}
					class="fl-press bg-card hover:bg-muted flex min-h-[max(5rem,80px)] w-full items-start gap-4 rounded-xl border p-4 text-start"
				>
					<span
						class="bg-[var(--fl-primary-tint)] text-primary grid size-12 shrink-0 place-items-center rounded-full"
					>
						<Icon size={24} aria-hidden="true" />
					</span>
					<span class="min-w-0 flex-1 [overflow-wrap:anywhere]">
						<span class="text-label block font-semibold">
							{t(`recipes.create.sources.${source.id}.title`)}
						</span>
						<span class="text-muted-foreground text-caption mt-1 block">
							{t(`recipes.create.sources.${source.id}.hint`)}
						</span>
						{#if locked(source)}
							<!-- Said in words with its own icon, not by a greyed-out tile: colour alone would hide why. -->
							<span class="text-caption mt-2 flex items-center gap-1.5 font-medium">
								<KeyRound size={14} aria-hidden="true" />
								{t('recipes.create.needsKey')}
							</span>
						{/if}
					</span>
				</button>
			</li>
		{/each}
	</ul>
{/if}
