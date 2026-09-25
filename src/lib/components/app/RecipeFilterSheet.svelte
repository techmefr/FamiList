<script lang="ts">
	import { tick } from 'svelte';
	import { t } from '$i18n/index.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import {
		activeCount,
		countIn,
		emptySelection,
		findRecipes,
		fixedKeys,
		ingredientOptions,
		toggleFilter,
		zonesOf,
		FILTER_CATEGORIES,
		OPTIONS_PAGE,
		type FilterableRecipe,
		type FilterCategory,
		type FilterOption,
		type FilterSelection
	} from '$domain/recipe-filter';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Separator } from '$components/ui/separator';
	import FilterSheet from '$components/app/FilterSheet.svelte';
	import IconField from '$components/app/IconField.svelte';
	import { Check, ChevronLeft, ChevronRight, Search } from '@lucide/svelte';

	let {
		selection = $bindable(),
		recipes,
		query
	}: {
		/** What the page filters on. Only "Show" writes it: closing the sheet otherwise leaves it as it was. */
		selection: FilterSelection;
		recipes: FilterableRecipe[];
		/** The page's own search, so the count on the button is the one the wall will show. */
		query: string;
	} = $props();

	let sheet = $state<FilterSheet | null>(null);
	let draft = $state<FilterSelection>(emptySelection());
	let category = $state<FilterCategory>('course');
	let search = $state('');
	let shown = $state(OPTIONS_PAGE);

	/**
	 * Two columns need room: at the largest text sizes, or on a phone, the categories become a list of their
	 * own and each one opens a detail view with a back button. Measured on the sheet in rem, not on the
	 * window, so the text size counts as much as the screen.
	 */
	const TWO_COLUMNS_REM = 34;
	let width = $state(0);
	let remPx = $state(16);
	const narrow = $derived(width < TWO_COLUMNS_REM * remPx);
	let view = $state<'categories' | 'detail'>('categories');

	let detailHeading = $state<HTMLHeadingElement | null>(null);
	let scroller = $state<HTMLDivElement | null>(null);
	let sentinel = $state<HTMLDivElement | null>(null);

	export function show() {
		sheet?.show();
	}

	function opened() {
		draft = structuredClone($state.snapshot(selection));
		search = '';
		shown = OPTIONS_PAGE;
		view = 'categories';
		remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
	}

	function labelOf(of: FilterCategory): string {
		if (of === 'ingredient') return t('recipes.filters.ingredient');
		if (of === 'time') return t('recipes.filters.time');
		return t(`recipeTags.category.${of}`);
	}

	const ingredients = $derived(ingredientOptions(recipes.flatMap((recipe) => recipe.ingredients)));

	function optionsOf(of: FilterCategory): FilterOption[] {
		if (of === 'ingredient') return ingredients;
		if (of === 'time') {
			return fixedKeys(of).map((key) => ({ key, label: t(`recipes.filters.timeOption.${key}`) }));
		}
		return fixedKeys(of).map((key) => ({ key, label: t(`recipeTags.tag.${key}`) }));
	}

	const options = $derived(optionsOf(category));
	const zones = $derived(zonesOf(options, draft[category], search));
	const matching = $derived(findRecipes(query, draft, recipes).length);

	async function pick(next: FilterCategory) {
		feedback.play('tap');
		if (next !== category) {
			category = next;
			search = '';
			shown = OPTIONS_PAGE;
			scroller?.scrollTo({ top: 0 });
		}

		if (narrow) {
			view = 'detail';
			await tick();
			detailHeading?.focus();
		}
	}

	async function back() {
		view = 'categories';
		await tick();
		document.querySelector<HTMLElement>(`[data-test-id="recipe-filter-category-${category}"]`)?.focus();
	}

	function toggle(key: string) {
		feedback.play('tap');
		draft = toggleFilter(draft, category, key);
	}

	function apply() {
		feedback.play('tap');
		selection = draft;
		sheet?.hide();
	}

	// Typing in the sheet's search starts the long list from its top again.
	$effect(() => {
		void search;
		shown = OPTIONS_PAGE;
	});

	/**
	 * The "all" zone grows as its end scrolls into view rather than drawing every ingredient of the
	 * household at once: a few hundred large rows with a checkbox each is what made the sheet slow to open.
	 */
	$effect(() => {
		if (!sentinel || !scroller) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) shown += OPTIONS_PAGE;
			},
			{ root: scroller, rootMargin: '200px' }
		);
		observer.observe(sentinel);

		return () => observer.disconnect();
	});
</script>

{#snippet optionRow(option: FilterOption, testClass: string)}
	<li>
		<label
			class="fl-press has-[:focus-visible]:ring-ring has-[:checked]:border-primary has-[:checked]:bg-primary/10 flex min-h-[max(3rem,48px)] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 has-[:focus-visible]:ring-2"
		>
			<input
				type="checkbox"
				checked={draft[category].includes(option.key)}
				onchange={() => toggle(option.key)}
				data-test-class={testClass}
				data-test-key={option.key}
				class="accent-primary size-6 shrink-0"
			/>
			<span class="text-label min-w-0 hyphens-auto [overflow-wrap:anywhere]">{option.label}</span>
		</label>
	</li>
{/snippet}

{#snippet categories()}
	<nav aria-label={t('recipes.filters.categories')} class="min-w-0">
		<ul class="space-y-1">
			{#each FILTER_CATEGORIES as entry (entry)}
				{@const count = countIn(draft, entry)}
				{@const current = !narrow && entry === category}
				<li>
					<button
						type="button"
						onclick={() => pick(entry)}
						aria-current={current ? 'true' : undefined}
						data-test-id="recipe-filter-category-{entry}"
						class="fl-press hover:bg-muted text-label flex min-h-[max(3rem,48px)] w-full items-center gap-2 rounded-lg px-3 py-2 text-start
							{current ? 'bg-[var(--fl-primary-tint)] text-primary font-semibold' : 'font-medium'}"
					>
						<span class="min-w-0 flex-1 hyphens-auto [overflow-wrap:anywhere]">{labelOf(entry)}</span>
						{#if count > 0}
							<span
								class="bg-primary text-primary-foreground text-caption grid min-w-6 shrink-0 place-items-center rounded-full px-1.5 font-semibold"
								data-test-id="recipe-filter-count-{entry}"
								aria-hidden="true"
							>
								{count}
							</span>
							<span class="sr-only">{t('recipes.filters.active', { count })}</span>
						{/if}
						{#if narrow}
							<ChevronRight size={18} aria-hidden="true" class="shrink-0 rtl:rotate-180" />
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	</nav>
{/snippet}

{#snippet detail()}
	<section aria-labelledby="recipe-filter-detail-title" class="min-w-0" data-test-id="recipe-filter-detail">
		{#if narrow}
			<Button
				variant="outline"
				onclick={back}
				data-test-id="recipe-filter-back"
				class="fl-press mb-3 h-auto min-h-[max(2.75rem,44px)] whitespace-normal"
			>
				<ChevronLeft size={18} aria-hidden="true" class="rtl:rotate-180" />
				{t('recipes.filters.back')}
			</Button>
		{/if}

		<h3
			id="recipe-filter-detail-title"
			bind:this={detailHeading}
			tabindex="-1"
			class="text-h2 font-semibold outline-none"
		>
			{labelOf(category)}
		</h3>

		<div class="mt-2">
			<Label for="recipe-filter-query">{t('recipes.filters.search')}</Label>
			<IconField icon={Search}>
				<Input
					id="recipe-filter-query"
					bind:value={search}
					type="search"
					autocomplete="off"
					data-test-id="recipe-filter-query"
					class="h-12"
				/>
			</IconField>
		</div>

		<!-- Its own scroll, so the search field and the two buttons stay in reach while the list moves. -->
		<div bind:this={scroller} class="mt-3 max-h-[45dvh] overflow-y-auto pe-1">
			{#if zones.selected.length}
				<h4 class="text-caption text-muted-foreground flex items-center gap-1.5 font-semibold">
					<Check size={14} aria-hidden="true" />
					{t('recipes.filters.selected')}
				</h4>
				<ul class="mt-1 space-y-1.5" data-test-id="recipe-filter-selected">
					{#each zones.selected as option (option.key)}
						{@render optionRow(option, 'recipe-filter-selected-option')}
					{/each}
				</ul>
				<Separator class="my-3" />
			{/if}

			<h4 class="text-caption text-muted-foreground font-semibold">{t('recipes.filters.all')}</h4>
			{#if zones.all.length === 0}
				<p class="text-muted-foreground text-label py-4" data-test-id="recipe-filter-none">
					{options.length === 0 ? t('recipes.filters.noIngredient') : t('recipes.filters.none')}
				</p>
			{:else}
				<ul class="mt-1 space-y-1.5" data-test-id="recipe-filter-all">
					{#each zones.all.slice(0, shown) as option (option.key)}
						{@render optionRow(option, 'recipe-filter-option')}
					{/each}
				</ul>
				{#if shown < zones.all.length}
					<div bind:this={sentinel} class="h-px" aria-hidden="true"></div>
				{/if}
			{/if}
		</div>
	</section>
{/snippet}

<FilterSheet
	bind:this={sheet}
	wide
	title={t('recipes.filters.title')}
	active={activeCount(draft)}
	onReset={() => (draft = emptySelection())}
	resetLabel={t('recipes.filters.clearAll')}
	testPrefix="recipe-filter"
	onOpen={opened}
>
	<div bind:clientWidth={width} class="mt-4" data-layout={narrow ? 'stacked' : 'columns'} data-test-id="recipe-filter-body">
		{#if !narrow}
			<div class="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)] gap-4">
				{@render categories()}
				{@render detail()}
			</div>
		{:else if view === 'categories'}
			{@render categories()}
		{:else}
			{@render detail()}
		{/if}
	</div>

	{#snippet actions()}
		<Button
			onclick={apply}
			data-test-id="recipe-filter-apply"
			class="fl-press h-auto min-h-[max(2.75rem,44px)] min-w-0 flex-1 basis-40 whitespace-normal"
		>
			{t('recipes.filters.apply', { count: matching })}
		</Button>
	{/snippet}
</FilterSheet>
