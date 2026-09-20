<script lang="ts">
	import { i18n, t, LOCALES } from '$i18n/index.svelte';
	import { ai } from '$stores/ai.svelte';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { DEFAULT_SERVINGS } from '$domain/recipe';
	import { aiRecipeConversation } from '$stores/ai-recipe-conversation.svelte';
	import { restrictionsOf, type SuggestedRecipe } from '$domain/ai-recipe';
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
	 * Ask the AI for a recipe by describing it in plain words ("un curry de poulet pour 4"), then keep
	 * talking to refine it ("et si je remplace le poulet par du tofu ?") — a real multi-turn conversation
	 * (#226), kept only for this browser tab in `aiRecipeConversation` and reset the moment this closes.
	 * Same rule as before: what leaves is exactly the text shown here, nothing more, and the raw JSON
	 * answer never reaches this screen — only the parsed cards below.
	 */
	let isOpen = $state(false);
	let message = $state('');

	const conversation = aiRecipeConversation;
	const language = $derived(LOCALES.find(l => l.code === i18n.locale)?.native ?? 'français');

	function toggle() {
		isOpen = !isOpen;
		if (!isOpen) conversation.reset();
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const text = message;
		message = '';

		await conversation.ask(text, {
			language,
			servings: DEFAULT_SERVINGS,
			restrictions: restrictionsOf(data.householdPersons)
		});

		const last = conversation.turns.at(-1);
		if (last?.role === 'assistant' && last.recipe) feedback.play('success');
	}

	/**
	 * Written the same way as `RecipeSuggestion.svelte`'s own `accept`: the recipe becomes a real household
	 * one straight away, editable and usable for a shopping list, and only on this click.
	 */
	function accept(index: number, suggestion: SuggestedRecipe) {
		feedback.play('add');
		data.addRecipe({
			name: suggestion.name,
			emoji: suggestion.emoji,
			servings: suggestion.servings,
			ingredients: suggestion.ingredients,
			steps: suggestion.steps
		});

		onAccepted?.(suggestion);
		conversation.accept(index);
	}
</script>

<!--
	The free-text "ask the AI for a recipe" entry point, reused as-is on the recipes screen and from both
	chat screens (#211), now a running thread (#226) instead of one round trip: prior turns stay visible,
	and the input at the bottom keeps taking follow-ups until the person closes it. Nothing but the
	person's own typed sentences and the resulting cards ever show: no prompt preview, no raw JSON.
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
					{#each conversation.turns as turn, index (index)}
						{#if turn.role === 'user'}
							<p class="text-label bg-muted rounded-lg p-3" data-test-id="ai-thread-user">
								{turn.text}
							</p>
						{:else if turn.error}
							<p class="text-destructive text-label" role="alert" data-test-id="ai-request-error">
								{turn.error.detail
									? t(`ai.error.${turn.error.reason}Detail`, { detail: turn.error.detail })
									: t(`ai.error.${turn.error.reason}`)}
							</p>
						{:else if turn.recipe && turn.accepted}
							<p
								class="text-secondary text-label flex items-center gap-2"
								role="status"
								data-test-id="ai-request-added"
							>
								{t('ai.added')}
							</p>
						{:else if turn.recipe && !turn.discarded}
							<RecipeSuggestionCard
								suggestion={turn.recipe}
								busy={conversation.busy}
								onAccept={() => turn.recipe && accept(index, turn.recipe)}
								onRetry={() => conversation.retry()}
								onDiscard={() => conversation.discard(index)}
							/>
						{/if}
					{/each}

					{#if conversation.busy}
						<p class="text-muted-foreground text-label" data-test-id="ai-request-asking">
							{t('ai.asking')}
						</p>
					{/if}

					<form onsubmit={submit} class="flex gap-2">
						<Input
							bind:value={message}
							aria-label={t('ai.request.title')}
							placeholder={conversation.hasStarted
								? t('ai.request.followUpPlaceholder')
								: t('ai.request.placeholder')}
							data-test-id="ai-request-input"
							required
						/>
						<Button
							type="submit"
							class="min-w-[44px]"
							disabled={conversation.busy}
							data-test-id="ai-request-submit"
							aria-label={t('ai.request.submit')}
						>
							<Send size={18} aria-hidden="true" />
						</Button>
					</form>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
{/if}
