<script lang="ts">
	import { supabase } from '$db/supabase';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { ai } from '$stores/ai.svelte';
	import { i18n, t, LOCALES } from '$i18n/index.svelte';
	import { DEFAULT_SERVINGS } from '$domain/recipe';
	import { recipeExtractionPrompt, restrictionsOf } from '$domain/ai-recipe';
	import { importErrorOf, type ImportError, type ImportedRecipe } from '$domain/recipe-import';
	import { draftFromImport, draftFromSuggestion, type RecipeDraft } from '$domain/recipe-draft';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import IconField from '$components/app/IconField.svelte';
	import { Link2, Download, Sparkles } from '@lucide/svelte';

	interface Props {
		/** Called with what the page gave, for the recipe form to show before anything is saved. */
		onDraft: (draft: RecipeDraft) => void;
	}

	const { onDraft }: Props = $props();

	/** The address typed, the wait, and the refusal. */
	let link = $state('');
	let importing = $state(false);
	let importRefusal = $state<ImportError | null>(null);

	/**
	 * The AI fallback (#182): the page's readable text, kept only when JSON-LD failed and the person has their
	 * own key set, and only ever sent to their own provider on a second, explicit gesture.
	 */
	let pageText = $state<string | null>(null);
	let pastedText = $state('');
	let aiExtracting = $state(false);
	let aiExtractError = $state('');

	const language = $derived(LOCALES.find((l) => l.code === i18n.locale)?.native ?? 'français');

	/**
	 * The reason for refusal returned by the edge function, and the page's readable text when it came with
	 * one — only on `no_recipe`, and only kept here for the person to decide whether to send it on.
	 *
	 * `functions.invoke` does not throw on a 4xx: it returns an error carrying the HTTP response in
	 * `context`. Without re-reading it, every refusal would look alike — "unreadable address" and "no
	 * recipe on this page" call for two opposite gestures.
	 */
	async function refusalReason(error: unknown): Promise<{ reason: ImportError; text: string | null }> {
		const context = (error as { context?: unknown } | null)?.context;
		if (!(context instanceof Response)) return { reason: 'unreachable', text: null };

		try {
			const body = await context.json();
			return {
				reason: importErrorOf(body?.error),
				text: typeof body?.text === 'string' && body.text ? body.text : null
			};
		} catch {
			return { reason: 'unreachable', text: null };
		}
	}

	async function importUrl(event: SubmitEvent) {
		event.preventDefault();

		const url = link.trim();
		if (!url || importing) return;

		importing = true;
		importRefusal = null;
		pageText = null;
		pastedText = '';
		aiExtractError = '';

		try {
			const { data: recipe, error } = await supabase.functions.invoke<ImportedRecipe>(
				'import-recipe',
				{ body: { url } }
			);

			if (error || !recipe) {
				const refusal = await refusalReason(error);
				importRefusal = refusal.reason;
				// Kept only when there is somewhere for it to go: with no key configured, this app offers no AI
				// fallback at all, and holding the text in memory for nothing would be pointless.
				pageText = refusal.reason === 'no_recipe' && ai.configured ? refusal.text : null;
				return;
			}

			feedback.play('add');
			onDraft(draftFromImport(recipe));
		} catch {
			// Offline, or function unavailable: for whoever is looking at the screen, it is the same thing.
			importRefusal = 'unreachable';
		} finally {
			importing = false;
		}
	}

	/**
	 * The one gesture that sends the page's text out to the person's own AI provider (#182, #222).
	 *
	 * It only exists after the screen has shown, in plain words, that this text is about to leave the device
	 * for the provider they already trust with their own key — the same rule `RecipeSuggestion.svelte`
	 * follows for the products already bought.
	 */
	async function tryAiExtraction() {
		const text = pageText || pastedText.trim();
		if (!text || aiExtracting) return;

		aiExtracting = true;
		aiExtractError = '';

		const prompt = recipeExtractionPrompt(text, {
			language,
			servings: DEFAULT_SERVINGS,
			restrictions: restrictionsOf(data.householdPersons)
		});
		const issue = await ai.suggestRecipe(prompt);
		aiExtracting = false;

		if (!issue.ok) {
			aiExtractError = issue.detail
				? t(`ai.error.${issue.reason}Detail`, { detail: issue.detail })
				: t(`ai.error.${issue.reason}`);
			return;
		}

		feedback.play('add');
		onDraft(draftFromSuggestion(issue.recipe));
	}
</script>

<!--
	What the address reveals is written in plain words above the field. The application is served statically
	and talks to nobody but its own database; fetching a third-party page means entrusting that address to
	the instance's server, which will introduce itself to the site visited. It is the project's first way out
	to the network, it only leaves on an explicit gesture, and saying so costs less than letting it be
	discovered.
-->
<form onsubmit={importUrl} class="space-y-3" data-test-id="recipe-import-form">
	<p class="text-muted-foreground text-caption">{t('recipes.import.privacy')}</p>

	<div>
		<Label for="recipe-import-url">{t('recipes.import.url')}</Label>
		<IconField icon={Link2}>
			<Input
				id="recipe-import-url"
				type="url"
				bind:value={link}
				data-test-id="recipe-import-url"
				placeholder={t('recipes.import.urlPlaceholder')}
			/>
		</IconField>
	</div>

	<Button
		type="submit"
		disabled={importing || !link.trim()}
		data-test-id="recipe-import-submit"
		class="fl-press"
	>
		<Download size={18} aria-hidden="true" />
		{importing ? t('recipes.import.loading') : t('recipes.import.submit')}
	</Button>

	<!--
		The refusal is announced, not only displayed: the person has just pasted an address and is looking at
		the field, not at the bottom of the block.
	-->
	<p class="text-caption text-destructive" role="alert" data-test-id="recipe-import-error">
		{#if importRefusal}
			{t(`recipes.import.error.${importRefusal}`)}
		{/if}
	</p>

	<!--
		Offered only when the page had no structured recipe AND the person already has their own key: with
		no key, this app has no AI feature at all, and there is nothing to offer.
	-->
	{#if pageText}
		<div class="space-y-2 rounded-lg border p-3" data-test-id="recipe-import-ai-fallback">
			<p class="text-caption">{t('recipes.import.ai.offer')}</p>
			<p class="text-muted-foreground text-caption">{t('recipes.import.ai.privacy')}</p>

			<Button
				type="button"
				variant="outline"
				disabled={aiExtracting}
				onclick={tryAiExtraction}
				data-test-id="recipe-import-ai-try"
				class="fl-press"
			>
				<Sparkles size={18} aria-hidden="true" />
				{aiExtracting ? t('recipes.import.ai.loading') : t('recipes.import.ai.submit')}
			</Button>

			{#if aiExtractError}
				<p class="text-caption text-destructive" role="alert" data-test-id="recipe-import-ai-error">
					{aiExtractError}
				</p>
			{/if}
		</div>
	{:else if importRefusal === 'unreachable' && ai.configured}
		<div class="space-y-3 rounded-lg border p-3" data-test-id="recipe-import-ai-fallback">
			<p class="text-caption">{t('recipes.import.ai.unreachableOffer')}</p>
			<div class="space-y-1">
				<Label for="recipe-import-paste">{t('recipes.import.ai.pasteLabel')}</Label>
				<textarea
					id="recipe-import-paste"
					bind:value={pastedText}
					rows={4}
					placeholder={t('recipes.import.ai.pastePlaceholder')}
					data-test-id="recipe-import-paste-input"
					class="border-input bg-background w-full rounded-md border p-2 text-sm"
				></textarea>
			</div>
			<p class="text-muted-foreground text-caption">{t('recipes.import.ai.privacy')}</p>

			<Button
				type="button"
				variant="outline"
				disabled={aiExtracting || !pastedText.trim()}
				onclick={tryAiExtraction}
				data-test-id="recipe-import-ai-try"
				class="fl-press"
			>
				<Sparkles size={18} aria-hidden="true" />
				{aiExtracting ? t('recipes.import.ai.loading') : t('recipes.import.ai.submit')}
			</Button>

			{#if aiExtractError}
				<p class="text-caption text-destructive" role="alert" data-test-id="recipe-import-ai-error">
					{aiExtractError}
				</p>
			{/if}
		</div>
	{/if}

	<p class="text-muted-foreground text-caption">{t('recipes.import.social')}</p>
</form>
