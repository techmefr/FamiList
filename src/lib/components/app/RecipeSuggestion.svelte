<script lang="ts">
	import { i18n, t, LOCALES } from '$i18n/index.svelte';
	import { ai } from '$stores/ai.svelte';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { recipePrompt, restrictionsOf, shoppedProducts, type SuggestedRecipe } from '$domain/ai-recipe';
	import { DEFAULT_SERVINGS, MAX_SERVINGS, MIN_SERVINGS } from '$domain/recipe';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import * as Card from '$components/ui/card';
	import IconField from '$components/app/IconField.svelte';
	import RecipeSuggestionCard from '$components/app/RecipeSuggestionCard.svelte';
	import { Sparkles, Users, Send, Check } from '@lucide/svelte';

	let isOpen = $state(false);
	let servings = $state(DEFAULT_SERVINGS);
	let busy = $state(false);
	let error = $state('');
	let suggestion = $state<SuggestedRecipe | null>(null);
	let saved = $state(false);

	const language = $derived(LOCALES.find(l => l.code === i18n.locale)?.native ?? 'français');

	/**
	 * The products already bought, as they will leave. This array is computed once and serves both uses: the
	 * list shown before sending and the instruction sent. It is the only way of being sure that what is shown
	 * is what leaves — two separate computations would end up diverging at the first change.
	 */
	const products = $derived(shoppedProducts(data.items));
	const restrictions = $derived(restrictionsOf(data.householdPersons));
	const prompt = $derived(
		recipePrompt(products, { language: language, servings: servings, restrictions })
	);

	function toggle() {
		isOpen = !isOpen;
		if (!isOpen) reset();
	}

	function reset() {
		suggestion = null;
		error = '';
		saved = false;
	}

	async function request() {
		busy = true;
		reset();

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

	/**
	 * The suggestion becomes a real household recipe, in the model that already exists: it can be read again,
	 * changed, and above all `generateList` turns it into a shopping list. An answer shown as text would have
	 * given none of those three gestures.
	 *
	 * It is only written on this click: nothing enters the household without somebody having read it.
	 */
	function accept() {
		if (!suggestion) return;

		feedback.play('add');
		data.addRecipe({
			name: suggestion.name,
			emoji: suggestion.emoji,
			servings: suggestion.servings,
			ingredients: suggestion.ingredients,
			steps: suggestion.steps,
			stepIngredients: suggestion.stepIngredients,
			imagePrompt: suggestion.imagePrompt,
			stepDurations: suggestion.stepDurations
		});

		saved = true;
		suggestion = null;
	}
</script>

<!--
	A recipe idea from what the household has already bought.

	The button does not exist while no key is set: this feature goes through a third party paid for by the
	person, and announcing it without being able to deliver it would be an empty promise.

	Nothing leaves on unfolding. We first show the exact list of the products concerned, then the full text of
	the request, and it is a second gesture that sends. The order matters: a screen that sent first and
	explained afterwards would leave no choice to refuse.
-->
{#if ai.configured}
	<div class="mt-4" data-test-id="ai-suggest-block">
		<Button variant="outline" onclick={toggle} data-test-id="ai-suggest-open">
			<Sparkles size={18} aria-hidden="true" />
			{t('ai.suggest')}
		</Button>

		{#if isOpen}
			<Card.Root class="mt-4">
				<Card.Header>
					<Card.Title class="text-h2">{t('ai.suggestTitle')}</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#if products.length === 0}
						<p class="text-muted-foreground text-label" data-test-id="ai-no-products">
							{t('ai.noProducts')}
						</p>
					{:else}
						<div>
							<h3 class="text-label font-semibold">
								{t('ai.willSend', { count: products.length })}
							</h3>
							<p class="text-muted-foreground text-caption mt-1">{t('ai.willSendHint')}</p>

							<!--
								The list is shown in full, not summarised as "40 products": consenting to a number is not consenting
								to its contents, and it is the contents that leave.
							-->
							<ul class="mt-2 flex flex-wrap gap-1.5" data-test-id="ai-products">
								{#each products as product (product)}
									<li class="bg-muted text-caption rounded-full px-2.5 py-1">{product}</li>
								{/each}
							</ul>
						</div>

						<div>
							<Label for="ai-servings">{t('recipes.people')}</Label>
							<IconField icon={Users}>
								<Input
									id="ai-servings"
									type="number"
									bind:value={servings}
									min={MIN_SERVINGS}
									max={MAX_SERVINGS}
									data-test-id="ai-servings"
								/>
							</IconField>
						</div>

						<details class="text-caption">
							<summary class="cursor-pointer underline" data-test-id="ai-prompt-toggle">
								{t('ai.seeExact')}
							</summary>
							<pre
								class="bg-muted mt-2 overflow-x-auto rounded-md p-3 whitespace-pre-wrap"
								data-test-id="ai-prompt">{prompt}</pre>
						</details>

						<p class="text-muted-foreground text-caption">
							{t('ai.sendingTo', { provider: t(`ai.providers.${ai.provider}`) })}
						</p>

						<Button
							class="fl-press"
							disabled={busy}
							onclick={request}
							data-test-id="ai-suggest-send"
						>
							<Send size={18} aria-hidden="true" />
							{busy ? t('ai.asking') : t('ai.sendConfirm')}
						</Button>
					{/if}

					{#if error}
						<p class="text-destructive text-label" role="alert" data-test-id="ai-suggest-error">
							{error}
						</p>
					{/if}

					{#if saved}
						<p
							class="text-secondary text-label flex items-center gap-2"
							role="status"
							data-test-id="ai-suggest-added"
						>
							<Check size={18} aria-hidden="true" />
							{t('ai.added')}
						</p>
					{/if}

					{#if suggestion}
						<!--
							Reading before writing. The suggestion comes from a third party: it can be wrong, unusable, or
							simply of no interest, and nothing must enter the household recipes without a human having seen it
							in full.
						-->
						<RecipeSuggestionCard
							{suggestion}
							{busy}
							onAccept={accept}
							onRetry={request}
							onDiscard={reset}
						/>
					{/if}
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
{/if}
