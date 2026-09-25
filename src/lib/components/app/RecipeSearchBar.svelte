<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { keyboardInset } from '$domain/keyboard-inset';
	import { Input } from '$components/ui/input';
	import IconField from '$components/app/IconField.svelte';
	import { Search, SlidersHorizontal, X } from '@lucide/svelte';

	let {
		query = $bindable(),
		active,
		onFilters,
		height = $bindable(0)
	}: {
		query: string;
		/** How many filters are on, shown on the button so a narrowed wall never looks like the whole one. */
		active: number;
		onFilters: () => void;
		/** The bar's own height: the page leaves that much room under its last card. */
		height?: number;
	} = $props();

	let field = $state<HTMLInputElement | null>(null);
	let focused = $state(false);
	let covered = $state(0);

	/**
	 * Android lays the keyboard over the page rather than shrinking it, so a bar fixed to the bottom ends up
	 * under the keys the moment the field it holds is tapped. `visualViewport` is what still knows how much
	 * of the screen is left.
	 */
	$effect(() => {
		const viewport = window.visualViewport;
		if (!viewport) return;

		const update = () => (covered = keyboardInset(window.innerHeight, viewport));
		update();
		viewport.addEventListener('resize', update);
		viewport.addEventListener('scroll', update);

		return () => {
			viewport.removeEventListener('resize', update);
			viewport.removeEventListener('scroll', update);
		};
	});

	/** Only for our own field: a keyboard opened by the recipe form must not lift the bar over what is typed. */
	const lifted = $derived(focused && covered > 0);

	function clear() {
		feedback.play('tap');
		query = '';
		field?.focus();
	}
</script>

<!--
	The thumb bar of the recipes page (#315).

	On a phone it floats above the navigation bar, where the hand holding the phone already is, and stops
	before the create button like the list's own bar. From tablet width on, `fl-above-nav` puts it back in
	the flow, at the top of the wall: the bottom of a large screen is far from the eye, and nothing there is
	held in one hand.

	It wraps rather than squeezing: at the largest text sizes the field takes a line of its own and the
	Filters button the next, full width, instead of both shrinking below a finger.
-->
<div
	bind:clientHeight={height}
	role="search"
	aria-label={t('recipes.search.label')}
	data-keyboard={lifted ? 'open' : undefined}
	style="--fl-keyboard: {covered}px"
	class="fl-above-nav fl-dock fl-recipe-bar mt-4 flex flex-wrap items-center gap-1"
	data-test-id="recipe-search-bar"
>
	<div class="min-w-0 flex-[999_1_10rem]">
		<label for="recipe-search" class="sr-only">{t('recipes.search.label')}</label>
		<IconField icon={Search}>
			<Input
				id="recipe-search"
				bind:ref={field}
				bind:value={query}
				type="search"
				enterkeyhint="search"
				autocomplete="off"
				placeholder={t('recipes.search.placeholder')}
				onfocus={() => (focused = true)}
				onblur={() => (focused = false)}
				data-test-id="recipe-search"
				class="text-label h-[max(3rem,48px)] rounded-full [&::-webkit-search-cancel-button]:hidden"
			/>
			{#snippet action()}
				{#if query}
					<button
						type="button"
						onclick={clear}
						aria-label={t('recipes.search.clear')}
						data-test-id="recipe-search-clear"
						class="fl-press text-muted-foreground hover:bg-muted me-1 grid size-[max(2.75rem,44px)] place-items-center rounded-full"
					>
						<X size={20} aria-hidden="true" />
					</button>
				{/if}
			{/snippet}
		</IconField>
	</div>

	<button
		type="button"
		onclick={onFilters}
		aria-haspopup="dialog"
		data-test-id="recipe-filters-open"
		class="fl-press fl-recipe-bar-filters bg-muted text-foreground text-label flex min-h-[max(3rem,48px)] flex-[1_0_auto] items-center justify-center gap-2 rounded-full px-4 font-medium"
	>
		<SlidersHorizontal size={18} aria-hidden="true" />
		{t('recipes.search.filters')}
		{#if active > 0}
			<span
				class="bg-primary text-primary-foreground text-caption grid min-w-6 place-items-center rounded-full px-1.5 font-semibold"
				data-test-id="recipe-filters-count"
				aria-hidden="true"
			>
				{active}
			</span>
			<span class="sr-only">{t('recipes.filters.active', { count: active })}</span>
		{/if}
	</button>
</div>
