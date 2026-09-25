<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import type { SuggestedRecipe } from '$domain/ai-recipe';
	import { unitKey } from '$domain/units';
	import { Button } from '$components/ui/button';
	import type { Conflict } from '$domain/ai-recipe-chat';
	import { Users, RotateCcw, TriangleAlert } from '@lucide/svelte';

	interface Props {
		suggestion: SuggestedRecipe;
		busy: boolean;
		onAccept: () => void;
		onRetry: () => void;
		onDiscard: () => void;
		/** Ingredients a constraint of the people at the table names (#313), shown before keeping. */
		conflicts?: Conflict[];
		/** Asks the AI for the same recipe without the conflicting ingredients. */
		onAvoid?: () => void;
	}

	const { suggestion, busy, onAccept, onRetry, onDiscard, conflicts = [], onAvoid }: Props = $props();
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

		{#if conflicts.length > 0}
			<!-- Said in words with its own icon and heading, never by a red tint alone. -->
			<div
				class="border-destructive bg-destructive/10 mt-5 space-y-2 rounded-lg border-2 p-3"
				role="alert"
				data-test-id="ai-proposal-conflicts"
			>
				<p class="text-label flex items-start gap-2 font-semibold">
					<TriangleAlert size={20} aria-hidden="true" class="mt-0.5 shrink-0" />
					{t('ai.chat.conflictTitle')}
				</p>
				<ul class="text-label space-y-1 ps-7">
					{#each conflicts as conflict (conflict.ingredient)}
						<li data-test-class="ai-proposal-conflict">
							{t('ai.chat.conflictLine', {
								ingredient: conflict.ingredient,
								constraint: conflict.constraint
							})}
						</li>
					{/each}
				</ul>
				{#if onAvoid}
					<Button variant="outline" onclick={onAvoid} disabled={busy} data-test-id="ai-proposal-avoid">
						{t('ai.chat.avoid')}
					</Button>
				{/if}
			</div>
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
