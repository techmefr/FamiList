<script lang="ts">
	import { i18n, t, LOCALES } from '$i18n/index.svelte';
	import { ai } from '$stores/ai.svelte';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { DEFAULT_SERVINGS } from '$domain/recipe';
	import { recipeFromRequestPrompt, restrictionsOf, type SuggestedRecipe } from '$domain/ai-recipe';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import * as Card from '$components/ui/card';
	import RecipeSuggestionCard from '$components/app/RecipeSuggestionCard.svelte';
	import { Sparkles, Send, X } from '@lucide/svelte';

	interface Props {
		/** Called once the person keeps a suggestion, in addition to it being saved as a household recipe. */
		onAccepted?: (recipe: SuggestedRecipe) => void;
	}

	const { onAccepted }: Props = $props();

	/**
	 * Ask the AI for a recipe by describing it in plain words ("un curry de poulet pour 4"), rather than
	 * starting from what the household has bought (`RecipeSuggestion.svelte`) or from a page's text
	 * (`recipes/+page.svelte`'s import). Same rule as those two: what leaves is exactly the text shown here,
	 * nothing more, and the raw JSON answer never reaches this screen — only the parsed card below.
	 */
	let isOpen = $state(false);
	let request = $state('');
	let lastRequest = $state('');
	let busy = $state(false);
	let error = $state('');
	let suggestion = $state<SuggestedRecipe | null>(null);
	let saved = $state(false);

	const language = $derived(LOCALES.find(l => l.code === i18n.locale)?.native ?? 'français');

	function toggle() {
		isOpen = !isOpen;
		if (!isOpen) reset();
	}

	function reset() {
		suggestion = null;
		error = '';
		saved = false;
	}

	async function ask(text: string) {
		const userText = text.trim();
		if (!userText || busy) return;

		busy = true;
		reset();
		lastRequest = userText;

		const prompt = recipeFromRequestPrompt(userText, {
			language,
			servings: DEFAULT_SERVINGS,
			restrictions: restrictionsOf(data.householdPersons)
		});
		const issue = await ai.suggestRecipe(prompt);
		busy = false;

		if (!issue.ok) {
			error = issue.detail
				? t(`ai.error.${issue.reason}Detail`, { detail: issue.detail })
				: t(`ai.error.${issue.reason}`);
			return;
		}

		suggestion = issue.recipe;
		feedback.play('success');
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		ask(request);
		request = '';
	}

	function retry() {
		ask(lastRequest);
	}

	/**
	 * Written the same way as `RecipeSuggestion.svelte`'s own `accept`: the recipe becomes a real household
	 * one straight away, editable and usable for a shopping list, and only on this click.
	 */
	function accept() {
		if (!suggestion) return;

		feedback.play('add');
		data.addRecipe({
			name: suggestion.name,
			emoji: suggestion.emoji,
			servings: suggestion.servings,
			ingredients: suggestion.ingredients,
			steps: suggestion.steps
		});

		onAccepted?.(suggestion);
		saved = true;
		suggestion = null;
	}
</script>

<!--
	The free-text "ask the AI for a recipe" entry point, reused as-is on the recipes screen and from both
	chat screens (#211). Nothing but the person's own typed sentence and the resulting card ever shows: no
	prompt preview, no raw JSON — that already sets it apart from `RecipeSuggestion.svelte`, which shows what
	is about to leave because it is drawn from the household's own purchases and deserves a second look first.
-->
{#if ai.configured}
	<div data-test-id="ai-request-block">
		<Button variant="outline" onclick={toggle} data-test-id="ai-request-open">
			<Sparkles size={18} aria-hidden="true" />
			{t('ai.request.trigger')}
		</Button>

		{#if isOpen}
			<Card.Root class="mt-4">
				<Card.Header class="flex flex-row items-start justify-between gap-2">
					<Card.Title class="text-h2">{t('ai.request.title')}</Card.Title>
					<button
						type="button"
						onclick={toggle}
						aria-label={t('common.close')}
						data-test-id="ai-request-close"
						class="fl-press text-muted-foreground hover:bg-muted grid min-h-[max(2.75rem,44px)] min-w-[44px] shrink-0 place-items-center rounded-full"
					>
						<X size={20} aria-hidden="true" />
					</button>
				</Card.Header>
				<Card.Content class="space-y-4">
					<form onsubmit={submit} class="flex gap-2">
						<Input
							bind:value={request}
							aria-label={t('ai.request.title')}
							placeholder={t('ai.request.placeholder')}
							data-test-id="ai-request-input"
							required
						/>
						<Button
							type="submit"
							class="min-w-[44px]"
							disabled={busy}
							data-test-id="ai-request-submit"
							aria-label={t('ai.request.submit')}
						>
							<Send size={18} aria-hidden="true" />
						</Button>
					</form>

					{#if busy}
						<p class="text-muted-foreground text-label" data-test-id="ai-request-asking">
							{t('ai.asking')}
						</p>
					{/if}

					{#if error}
						<p class="text-destructive text-label" role="alert" data-test-id="ai-request-error">
							{error}
						</p>
					{/if}

					{#if saved}
						<p
							class="text-secondary text-label flex items-center gap-2"
							role="status"
							data-test-id="ai-request-added"
						>
							{t('ai.added')}
						</p>
					{/if}

					{#if suggestion}
						<RecipeSuggestionCard {suggestion} {busy} onAccept={accept} onRetry={retry} onDiscard={reset} />
					{/if}
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
{/if}
