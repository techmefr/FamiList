<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import type { SuggestedRecipe } from '$domain/ai-recipe';
	import { unitKey } from '$domain/units';
	import { Button } from '$components/ui/button';
	import { Users, RotateCcw } from '@lucide/svelte';

	interface Props {
		suggestion: SuggestedRecipe;
		busy: boolean;
		onAccept: () => void;
		onRetry: () => void;
		onDiscard: () => void;
	}

	const { suggestion, busy, onAccept, onRetry, onDiscard }: Props = $props();
</script>

<!--
	The read-before-write card shared by every "ask the AI for a recipe" entry point (products already
	bought, a page's text, or a free-text request): whatever built the prompt, the person always sees the
	same card and the same three gestures before anything is written.
-->
<div class="overflow-hidden rounded-lg border" data-test-id="ai-proposal">
	<div class="flex items-start gap-3 border-b bg-[var(--fl-primary-tint)] p-4">
		<span class="text-4xl leading-none" aria-hidden="true">{suggestion.emoji}</span>
		<div class="min-w-0 flex-1">
			<h3 class="text-product break-words font-semibold">{suggestion.name}</h3>
			<span
				class="bg-primary text-primary-foreground text-caption mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold"
			>
				<Users size={12} aria-hidden="true" />
				{t('recipes.servingsCount', { count: suggestion.servings })}
			</span>
		</div>
	</div>

	<div class="p-4">
		<h4 class="text-label text-muted-foreground font-semibold tracking-wide uppercase">
			{t('recipes.step.ingredients')}
		</h4>
		<ul class="text-label mt-2 space-y-1.5">
			{#each suggestion.ingredients as row, index (index)}
				<li class="flex items-baseline gap-2 border-b border-dashed pb-1.5 last:border-0 last:pb-0">
					<span class="min-w-0 flex-1">{row.name}</span>
					{#if row.qty}
						<span class="text-muted-foreground text-caption shrink-0 font-medium">
							{row.qty}
							{t(unitKey(row.unit) ?? 'units.piece')}
						</span>
					{/if}
				</li>
			{/each}
		</ul>

		{#if suggestion.steps.some(Boolean)}
			<h4 class="text-label text-muted-foreground mt-5 font-semibold tracking-wide uppercase">
				{t('recipes.step.steps')}
			</h4>
			<ol class="mt-2 space-y-3">
				{#each suggestion.steps.filter(Boolean) as step, index (index)}
					<li class="flex items-start gap-3">
						<span
							class="bg-muted text-foreground text-label grid size-7 shrink-0 place-items-center rounded-full font-bold"
							aria-hidden="true"
						>
							{index + 1}
						</span>
						<span class="text-label pt-0.5">{step}</span>
					</li>
				{/each}
			</ol>
		{/if}

		<div class="mt-4 flex flex-wrap gap-2">
			<Button class="fl-press" onclick={onAccept} data-test-id="ai-proposal-accept">
				{t('ai.keep')}
			</Button>
			<Button variant="outline" onclick={onRetry} disabled={busy} data-test-id="ai-proposal-retry">
				<RotateCcw size={18} aria-hidden="true" />
				{t('ai.retry')}
			</Button>
			<Button variant="outline" onclick={onDiscard} data-test-id="ai-proposal-discard">
				{t('ai.discard')}
			</Button>
		</div>
	</div>
</div>
