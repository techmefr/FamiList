<script lang="ts">
	import { i18n, t, LOCALES } from '$i18n/index.svelte';
	import { ai } from '$stores/ai.svelte';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { DEFAULT_SERVINGS } from '$domain/recipe';
	import { recipeFromPhotoPrompt, restrictionsOf, type SuggestedRecipe } from '$domain/ai-recipe';
	import { Button } from '$components/ui/button';
	import * as Card from '$components/ui/card';
	import RecipeSuggestionCard from '$components/app/RecipeSuggestionCard.svelte';
	import { Camera, X } from '@lucide/svelte';

	interface Props {
		/** Called once the person keeps a suggestion, in addition to it being saved as a household recipe. */
		onAccepted?: (recipe: SuggestedRecipe) => void;
	}

	const { onAccepted }: Props = $props();

	/**
	 * "Create a recipe by photo" (#266): a book page or a written/printed recipe, read by the active
	 * provider's vision model, then handed to the very same read-before-write review card the free-text
	 * request already uses — nothing here writes a recipe straight from what the model answered.
	 */
	let input = $state<HTMLInputElement | null>(null);
	let isOpen = $state(false);
	let busy = $state(false);
	let suggestion = $state<SuggestedRecipe | null>(null);
	let error = $state<{ reason: 'network' | 'provider' | 'unreadable' | 'unsupported'; detail: string } | null>(
		null
	);

	const language = $derived(LOCALES.find(l => l.code === i18n.locale)?.native ?? 'français');

	function toggle() {
		isOpen = !isOpen;
		if (!isOpen) reset();
	}

	function reset() {
		suggestion = null;
		error = null;
		busy = false;
		if (input) input.value = '';
	}

	/** A `File` read as a base64 string, without its `data:...;base64,` prefix. */
	function toBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = typeof reader.result === 'string' ? reader.result : '';
				const comma = result.indexOf(',');
				resolve(comma === -1 ? result : result.slice(comma + 1));
			};
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(file);
		});
	}

	async function choose(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;

		if (!ai.supportsVision) {
			error = { reason: 'unsupported', detail: '' };
			return;
		}

		suggestion = null;
		error = null;
		busy = true;

		const imageBase64 = await toBase64(file);
		const prompt = recipeFromPhotoPrompt({
			language,
			servings: DEFAULT_SERVINGS,
			restrictions: restrictionsOf(data.householdPersons)
		});

		const outcome = await ai.suggestRecipeFromPhoto(imageBase64, file.type || 'image/jpeg', prompt);
		busy = false;
		if (input) input.value = '';

		if (outcome.ok) {
			suggestion = outcome.recipe;
			feedback.play('success');
		} else {
			error = { reason: outcome.reason, detail: outcome.detail };
		}
	}

	function retry() {
		input?.click();
	}

	function discard() {
		suggestion = null;
	}

	/** Written the same way as the free-text flow's own `accept`. */
	function accept() {
		if (!suggestion) return;

		feedback.play('add');
		data.addRecipe({
			name: suggestion.name,
			emoji: suggestion.emoji,
			servings: suggestion.servings,
			ingredients: suggestion.ingredients,
			steps: suggestion.steps,
			stepIngredients: suggestion.stepIngredients
		});

		onAccepted?.(suggestion);
		suggestion = null;
		isOpen = false;
	}
</script>

<!--
	"Create a recipe by photo" (#266): shown next to the free-text AI request, only when a key is set. Once a
	provider whose active model cannot read an image is selected, the button still shows — closing the door
	only at the moment a photo is actually chosen would hide a real capability of other providers behind a
	generic "no AI" message — but choosing a photo then explains why, instead of sending it and letting the
	provider fail on its own terms.
-->
{#if ai.configured}
	<div data-test-id="ai-photo-block">
		<Button variant="outline" onclick={toggle} data-test-id="ai-photo-open">
			<Camera size={18} aria-hidden="true" />
			{t('ai.photo.trigger')}
		</Button>

		{#if isOpen}
			<Card.Root class="mt-4">
				<Card.Header class="flex flex-row items-start justify-between gap-2">
					<Card.Title class="text-h2">{t('ai.photo.title')}</Card.Title>
					<button
						type="button"
						onclick={toggle}
						aria-label={t('common.close')}
						data-test-id="ai-photo-close"
						class="fl-press text-muted-foreground hover:bg-muted grid min-h-[max(2.75rem,44px)] min-w-[44px] shrink-0 place-items-center rounded-full"
					>
						<X size={20} aria-hidden="true" />
					</button>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#if !ai.supportsVision}
						<p class="text-destructive text-label" role="alert" data-test-id="ai-photo-unsupported">
							{t('ai.photo.unsupported')}
						</p>
					{:else if suggestion}
						<RecipeSuggestionCard {suggestion} {busy} onAccept={accept} onRetry={retry} onDiscard={discard} />
					{:else if error}
						<p class="text-destructive text-label" role="alert" data-test-id="ai-photo-error">
							{error.detail
								? t(`ai.error.${error.reason}Detail`, { detail: error.detail })
								: t(`ai.error.${error.reason}`)}
						</p>
						<Button variant="outline" onclick={retry} data-test-id="ai-photo-retry">
							{t('ai.retry')}
						</Button>
					{:else if busy}
						<p class="text-muted-foreground text-label" data-test-id="ai-photo-reading">
							{t('ai.photo.reading')}
						</p>
					{:else}
						<p class="text-muted-foreground text-label">{t('ai.photo.hint')}</p>
						<Button onclick={() => input?.click()} data-test-id="ai-photo-pick" class="fl-press">
							<Camera size={18} aria-hidden="true" />
							{t('ai.photo.pick')}
						</Button>
					{/if}
				</Card.Content>
			</Card.Root>
		{/if}
	</div>

	<input
		bind:this={input}
		type="file"
		accept="image/*"
		capture="environment"
		onchange={choose}
		aria-label={t('ai.photo.pick')}
		data-test-id="ai-photo-input"
		class="sr-only"
	/>
{/if}
