<script lang="ts">
	import { i18n, t, LOCALES } from '$i18n/index.svelte';
	import { ai } from '$stores/ai.svelte';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { DEFAULT_SERVINGS } from '$domain/recipe';
	import { recipeFromPhotoPrompt, restrictionsOf, type SuggestedRecipe } from '$domain/ai-recipe';
	import { draftFromSuggestion, type RecipeDraft } from '$domain/recipe-draft';
	import { Button } from '$components/ui/button';
	import RecipeSuggestionCard from '$components/app/RecipeSuggestionCard.svelte';
	import { Camera } from '@lucide/svelte';

	interface Props {
		/** Called with the kept suggestion, for the recipe form to show before anything is saved. */
		onDraft: (draft: RecipeDraft) => void;
	}

	const { onDraft }: Props = $props();

	/**
	 * "Create a recipe by photo" (#266): a book page or a written/printed recipe, read by the active
	 * provider's vision model, then handed to the very same read-before-write review card the free-text
	 * request already uses — nothing here writes a recipe straight from what the model answered.
	 */
	let input = $state<HTMLInputElement | null>(null);
	let busy = $state(false);
	let suggestion = $state<SuggestedRecipe | null>(null);
	let error = $state<{ reason: 'network' | 'provider' | 'unreadable' | 'unsupported'; detail: string } | null>(
		null
	);

	const language = $derived(LOCALES.find(l => l.code === i18n.locale)?.native ?? 'français');

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

	/** Nothing is written here: the person reads and corrects it in the form, and only the form saves (#311). */
	function accept() {
		if (!suggestion) return;

		feedback.play('add');
		onDraft(draftFromSuggestion(suggestion));
		suggestion = null;
	}
</script>

<!--
	"Create a recipe by photo" (#266), one of the "Create a recipe" sources (#311). Once a provider whose
	active model cannot read an image is selected, the source still opens — closing the door only at the
	moment a photo is actually chosen would hide a real capability of other providers behind a generic "no
	AI" message — but it then explains why, instead of sending it and letting the provider fail on its own
	terms.
-->
{#if ai.configured}
	<div class="space-y-4" data-test-id="ai-photo-block">
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
