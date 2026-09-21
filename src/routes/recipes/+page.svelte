<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '$db/supabase';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { ai } from '$stores/ai.svelte';
	import { createIntent } from '$stores/create.svelte';
	import { i18n, t, LOCALES } from '$i18n/index.svelte';
	import { motionMs } from '$stores/settings.svelte';
	import { DEFAULT_SERVINGS, MAX_SERVINGS, MIN_SERVINGS, type RecipeLine } from '$domain/recipe';
	import type { Recipe } from '$db/schema';
	import { recipeExtractionPrompt, restrictionsOf, type SuggestedRecipe } from '$domain/ai-recipe';
	import {
		importErrorOf,
		importedLines,
		parseImportedServings,
		type ImportError,
		type ImportedRecipe
	} from '$domain/recipe-import';
	import { UNITS, DEFAULT_UNIT } from '$domain/units';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import * as Card from '$components/ui/card';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import EmojiPicker from '$components/app/EmojiPicker.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';
	import IconField from '$components/app/IconField.svelte';
	import RecipeSuggestion from '$components/app/RecipeSuggestion.svelte';
	import AiRecipeRequest from '$components/app/AiRecipeRequest.svelte';
	import RecipePhoto from '$components/app/RecipePhoto.svelte';
	import RecipeCover from '$components/app/RecipeCover.svelte';
	import {
		CookingPot,
		Hash,
		Plus,
		ShoppingBasket,
		Trash2,
		Users,
		ChevronLeft,
		ChevronRight,
		Check,
		Link2,
		Download,
		Sparkles,
		CalendarDays,
		Pencil
	} from '@lucide/svelte';

	/**
	 * The three stages of typing. A whole recipe rarely fits on a phone screen, and asking everything at
	 * once — the name, ten ingredients, six steps — gives a form you close before starting it. So we ask
	 * what it is, then what to buy, then how you go about it: the order a recipe is really written in.
	 *
	 * The steps are an array and not three booleans: the indicator at the top is then derived from the same
	 * state as the content, and neither can drift from the other.
	 */
	const STEPS = ['recipe', 'ingredients', 'steps'] as const;
	type Step = (typeof STEPS)[number];

	const DEFAULT_EMOJI = '🍲';

	let creating = $state(false);
	let step = $state<Step>('recipe');
	let picker = $state<EmojiPicker | null>(null);

	/** `null` means the open form, if any, is creating a recipe. Set, it is rewriting the recipe of this id. */
	let editingId = $state<string | null>(null);

	let name = $state('');
	let emoji = $state(DEFAULT_EMOJI);
	let servings = $state(DEFAULT_SERVINGS);
	let lines = $state<RecipeLine[]>([{ name: '', qty: '', unit: DEFAULT_UNIT }]);
	let steps = $state<string[]>(['']);

	/** The recipe whose generation is unfolded, and what is being asked of it. */
	let generatingFor = $state<string | null>(null);
	let guestCount = $state(DEFAULT_SERVINGS);
	let target = $state('');
	let toDelete = $state<string | null>(null);

	/**
	 * Which cards are unfolded, in the Pinterest grid below. A `Set` and not a single id: unlike the
	 * generation form or the delete confirmation, which only ever make sense for one recipe at a time,
	 * reading two recipes open side by side is a normal thing to want in a grid.
	 */
	let expandedIds = $state(new Set<string>());

	function toggleExpanded(recipeId: string) {
		const next = new Set(expandedIds);
		if (next.has(recipeId)) {
			next.delete(recipeId);
		} else {
			next.add(recipeId);
		}
		expandedIds = next;
	}

	/** The import from a link: the address typed, the wait, the refusal, and the fact of having served. */
	let link = $state('');
	let importing = $state(false);
	let importRefusal = $state<ImportError | null>(null);
	let fromImport = $state(false);

	/**
	 * The page's own photo, carried along the draft (#236). It has nowhere to live until the recipe itself
	 * is saved and gets an id — `recipe-photos` paths are keyed by recipe — so it is fetched and attached
	 * right after that save, the same review-then-save gesture already covering the rest of the draft.
	 */
	let importedImage = $state<string | null>(null);

	/**
	 * The AI fallback (#182): the page's readable text, kept only when JSON-LD failed and the person has their
	 * own key set, and only ever sent to their own provider on a second, explicit gesture.
	 */
	let pageText = $state<string | null>(null);
	let pastedText = $state('');
	let aiExtracting = $state(false);
	let aiExtractError = $state('');

	const rank = $derived(STEPS.indexOf(step));
	const isLast = $derived(rank === STEPS.length - 1);
	const language = $derived(LOCALES.find((l) => l.code === i18n.locale)?.native ?? 'français');

	// The central button brings you here to create: the form must already be unfolded on arrival.
	$effect(() => {
		if (createIntent.take('recipe')) open();
	});

	function open() {
		creating = true;
		step = 'recipe';
	}

	function reset() {
		creating = false;
		editingId = null;
		step = 'recipe';
		name = '';
		emoji = DEFAULT_EMOJI;
		servings = DEFAULT_SERVINGS;
		lines = [{ name: '', qty: '', unit: DEFAULT_UNIT }];
		steps = [''];
		fromImport = false;
		importRefusal = null;
		pageText = null;
		pastedText = '';
		aiExtractError = '';
		importedImage = null;
	}

	/**
	 * Opens the same multi-step form the recipe was written in, prefilled from what is saved, and turns its
	 * next save into a rewrite instead of a new recipe. Ingredients and steps come from the same source the
	 * card already reads them from (`ingredientsOf`/`stepsOf`), in their saved order.
	 */
	function edit(recipe: Recipe) {
		editingId = recipe.id;
		name = recipe.name;
		emoji = recipe.emoji;
		servings = recipe.servings;

		const existingLines = data
			.ingredientsOf(recipe.id)
			.map((line) => ({ name: line.name, qty: line.qty, unit: line.unit }));
		lines = existingLines.length ? existingLines : [{ name: '', qty: '', unit: DEFAULT_UNIT }];

		const existingSteps = data.stepsOf(recipe.id).map((step) => step.body);
		steps = existingSteps.length ? existingSteps : [''];

		creating = true;
		step = 'recipe';
		fromImport = false;
	}

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

	/**
	 * Puts the fetched recipe into the form, saving nothing.
	 *
	 * That is the whole point of the manoeuvre: what comes back from an unknown page is a draft. The
	 * quantities are split as best we can, some lines come back as they are, and the number of servings is
	 * sometimes missing. The person reads it, corrects it, then saves — as if they had typed the recipe
	 * themselves, but without having typed it.
	 */
	function prefill(recipe: ImportedRecipe) {
		const imported = importedLines(recipe.ingredients);

		name = recipe.name ?? '';
		emoji = DEFAULT_EMOJI;
		servings = parseImportedServings(recipe.servings) ?? DEFAULT_SERVINGS;
		lines = imported.length ? imported : [{ name: '', qty: '', unit: DEFAULT_UNIT }];
		steps = recipe.steps.length ? recipe.steps : [''];

		creating = true;
		step = 'recipe';
		fromImport = true;
		importedImage = recipe.image;
		link = '';
	}

	/**
	 * Puts an AI-drafted recipe into the form (#182), the same gesture as `prefill`: nothing is written to
	 * the database here, the person reads it and corrects it like any other draft.
	 */
	function prefillFromSuggestion(recipe: SuggestedRecipe) {
		name = recipe.name;
		emoji = recipe.emoji;
		servings = recipe.servings;
		lines = recipe.ingredients.length ? recipe.ingredients : [{ name: '', qty: '', unit: DEFAULT_UNIT }];
		steps = recipe.steps.length ? recipe.steps : [''];

		creating = true;
		step = 'recipe';
		fromImport = true;
		link = '';
		pageText = null;
		pastedText = '';
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
			prefill(recipe);
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
		prefillFromSuggestion(issue.recipe);
	}

	/**
	 * The form opens on a single row, and a button adds more, rather than an empty row appearing as soon as
	 * you fill the last one. A recipe has three ingredients as often as fifteen: a form that lengthens on
	 * its own while you type moves what you are reading, and announces nothing to a screen reader.
	 *
	 * The last row cannot be removed: an ingredient form with no field can no longer be filled, and it
	 * would take a second button to make one reappear.
	 */
	function addRow() {
		lines = [...lines, { name: '', qty: '', unit: DEFAULT_UNIT }];
	}

	function removeRow(index: number) {
		lines = lines.length > 1 ? lines.filter((_, i) => i !== index) : lines;
	}

	function addStep() {
		steps = [...steps, ''];
	}

	function removeStep(index: number) {
		steps = steps.length > 1 ? steps.filter((_, i) => i !== index) : steps;
	}

	function goBack() {
		if (rank > 0) step = STEPS[rank - 1];
	}

	/**
	 * The same button moves on a stage or saves, depending on where you are. A single `submit` for both:
	 * the Enter key then does what you expect of it at each step, which a "next" button outside the form
	 * would not give.
	 */
	function goNext(event: SubmitEvent) {
		event.preventDefault();

		if (!isLast) {
			step = STEPS[rank + 1];
			return;
		}

		if (!name.trim()) return;

		feedback.play('add');
		if (editingId) {
			data.updateRecipe(editingId, { name, emoji, servings, ingredients: lines, steps });
		} else {
			const recipe = data.addRecipe({ name, emoji, servings, ingredients: lines, steps });
			attachImportedPhoto(recipe.id);
		}
		reset();
	}

	/**
	 * Fetches the page's own photo and attaches it, the same upload path a generated photo already uses
	 * (`ai.fetchRecipePhoto` → `data.setRecipePhoto`). Decorative only, like the generated photo: a failure
	 * here leaves the plain card standing, with nothing surfaced to the person.
	 */
	function attachImportedPhoto(recipeId: string) {
		const imageUrl = importedImage;
		if (!imageUrl) return;

		void ai.fetchRecipePhoto(data.circle, recipeId, imageUrl).then((outcome) => {
			if (outcome.ok) data.setRecipePhoto(recipeId, outcome.path);
		});
	}

	function remove(id: string) {
		feedback.play('remove');
		data.removeRecipe(id);
		toDelete = null;
		if (generatingFor === id) generatingFor = null;

		if (expandedIds.has(id)) {
			const next = new Set(expandedIds);
			next.delete(id);
			expandedIds = next;
		}
	}

	function toggleGeneration(recipeId: string) {
		if (generatingFor === recipeId) {
			generatingFor = null;
			return;
		}

		generatingFor = recipeId;
		// We start from the recipe's own number of servings: most of the time you cook for that number, and the
		// field is then already right.
		guestCount = data.recipe(recipeId)?.servings ?? DEFAULT_SERVINGS;
		target = '';
	}

	async function generate(recipeId: string) {
		const issue = data.generateList(recipeId, guestCount, target || undefined);
		if (!issue) return;

		feedback.play('add');
		generatingFor = null;
		await goto(`/l/${issue.listId}`);
	}
</script>

<!--
	The household's recipes.

	A recipe is shared as soon as it is written: the household is a sharing circle, and everything entering
	it is read there. So there is no sharing gesture on this screen — its absence is the feature.

	What comes out of a recipe is a shopping list, not a link: the items created live their own life, you
	tick them and correct them in front of the aisle without the recipe moving.
-->
<svelte:head>
	<title>{t('recipes.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('recipes.title')}</h1>
<p class="text-muted-foreground text-label mt-1">{t('recipes.intro')}</p>

<!--
	The meal plan is a separate screen, not a mode of this one: picking several recipes for the week is a
	different gesture from writing one, and folding it in here would push what this page does first further
	down.
-->
<a
	href="/meal-plan"
	data-test-id="recipes-meal-plan-link"
	class="text-accent-foreground text-label mt-2 inline-flex items-center gap-1 font-medium"
>
	<CalendarDays size={18} aria-hidden="true" />
	{t('recipes.mealPlanLink')}
</a>

{#if !creating}
	<Button onclick={open} data-test-id="recipe-new" class="fl-press mt-4">
		<Plus size={18} aria-hidden="true" />
		{t('create.recipe')}
	</Button>

	<!-- Only appears if an AI key is set in the settings; otherwise, nothing at all. -->
	<RecipeSuggestion />

	<div class="mt-4">
		<AiRecipeRequest />
	</div>

	<!--
		The import from a link, placed under manual creation and not in its place: a family recipe comes from
		no web page, and that is what this screen serves first.

		What the address reveals is written in plain words above the field. The application is served
		statically and talks to nobody but its own database; fetching a third-party page means entrusting that
		address to the instance's server, which will introduce itself to the site visited. It is the project's
		first way out to the network, it only leaves on an explicit gesture, and saying so costs less than
		letting it be discovered.
	-->
	<form onsubmit={importUrl} class="bg-card mt-4 space-y-3 rounded-xl border p-4">
		<h2 class="text-h2 font-semibold">{t('recipes.import.title')}</h2>
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
			variant="outline"
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
			<div
				class="space-y-2 rounded-lg border p-3"
				data-test-id="recipe-import-ai-fallback"
			>
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
			<div
				class="space-y-3 rounded-lg border p-3"
				data-test-id="recipe-import-ai-fallback"
			>
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
{:else}
	<form onsubmit={goNext} class="bg-card mt-4 space-y-5 rounded-xl border p-4">
		{#if fromImport}
			<!--
				What comes from a web page is a draft, and the screen must say so before the person saves. The
				quantities are split as best we can, the lines we could not read — "2 tablespoons of oil" — have come
				back whole in the name field, and none of it is written to the database until the form is submitted.
			-->
			<p
				class="text-label rounded-lg bg-[var(--fl-primary-tint)] p-3"
				data-test-id="recipe-import-review"
			>
				{t('recipes.import.review')}
			</p>
		{/if}

		<!--
			Where you are, said in full and not only by a coloured bar: "step 2 of 3" reads to a screen reader as
			much as to the eye, and a bar alone says neither how many are left nor what they contain.
		-->
		<ol class="flex flex-wrap gap-2" aria-label={t('recipes.stepper')}>
			{#each STEPS as id, index (id)}
				<li
					class="text-caption rounded-full border px-3 py-1 {step === id
						? 'bg-[var(--fl-primary-tint)] text-primary border-transparent font-semibold'
						: 'text-muted-foreground'}"
					aria-current={step === id ? 'step' : undefined}
				>
					{index + 1}. {t(`recipes.step.${id}`)}
				</li>
			{/each}
		</ol>

		{#if step === 'recipe'}
			<div class="space-y-4">
				<h2 class="text-h2 font-semibold">{t('recipes.step.recipe')}</h2>

				<div class="grid gap-3 sm:grid-cols-[auto_1fr]">
					<div class="w-20">
						<Label for="recipe-emoji">{t('recipes.emoji')}</Label>
						<button
							type="button"
							id="recipe-emoji"
							onclick={() => picker?.show()}
							aria-haspopup="dialog"
							data-test-id="recipe-emoji"
							class="border-input bg-background fl-press grid min-h-[max(2.75rem,44px)] w-full place-items-center rounded-lg border text-2xl"
						>
							<span aria-hidden="true">{emoji}</span>
							<span class="sr-only">{t('emojiPicker.current', { emoji })}</span>
						</button>
					</div>

					<div>
						<Label for="recipe-name">{t('recipes.name')}</Label>
						<IconField icon={CookingPot}>
							<Input
								id="recipe-name"
								bind:value={name}
								data-test-id="recipe-name"
								required
								placeholder={t('recipes.namePlaceholder')}
							/>
						</IconField>
					</div>
				</div>

				<!--
					The number of servings is not decoration: it is the denominator of the scaling. "400 g of pasta" means
					nothing until you know how many people it is written for, and it is what makes it possible to
					generate for six a recipe written for four.
				-->
				<div>
					<Label for="recipe-servings">{t('recipes.servings')}</Label>
					<IconField icon={Users}>
						<Input
							id="recipe-servings"
							type="number"
							bind:value={servings}
							min={MIN_SERVINGS}
							max={MAX_SERVINGS}
							data-test-id="recipe-servings"
						/>
					</IconField>
					<p class="text-muted-foreground text-caption">{t('recipes.servingsHint')}</p>
				</div>
			</div>
		{:else if step === 'ingredients'}
			<div class="space-y-4">
				<h2 class="text-h2 font-semibold">{t('recipes.step.ingredients')}</h2>
				<p class="text-muted-foreground text-caption">{t('recipes.ingredientsHint')}</p>

				<ul class="space-y-3" data-test-id="recipe-ingredients">
					{#each lines as line, index (index)}
						<li class="grid gap-2 sm:grid-cols-[1fr_6rem_8rem_auto]">
							<div>
								<Label for="ingredient-name-{index}">
									{t('recipes.ingredientName', { rank: index + 1 })}
								</Label>
								<IconField icon={ShoppingBasket}>
									<Input
										id="ingredient-name-{index}"
										bind:value={line.name}
										data-test-class="ingredient-name"
										placeholder={t('recipes.ingredientPlaceholder')}
									/>
								</IconField>
							</div>

							<div>
								<Label for="ingredient-qty-{index}">{t('recipes.qty')}</Label>
								<Input
									id="ingredient-qty-{index}"
									bind:value={line.qty}
									inputmode="decimal"
									data-test-class="ingredient-qty"
								/>
							</div>

							<div>
								<Label for="ingredient-unit-{index}">{t('recipes.unit')}</Label>
								<select
									id="ingredient-unit-{index}"
									bind:value={line.unit}
									data-test-class="ingredient-unit"
									class="border-input bg-background min-h-[max(2.75rem,44px)] w-full rounded-md border"
								>
									{#each UNITS as id (id)}
										<option value={id}>{t(`units.${id}`)}</option>
									{/each}
								</select>
							</div>

							<div class="flex items-end">
								<Button
									type="button"
									variant="outline"
									onclick={() => removeRow(index)}
									disabled={lines.length === 1}
									aria-label={t('recipes.removeIngredient', { rank: index + 1 })}
									data-test-class="ingredient-remove"
									class="fl-press"
								>
									<Trash2 size={18} aria-hidden="true" />
								</Button>
							</div>
						</li>
					{/each}
				</ul>

				<Button
					type="button"
					variant="outline"
					onclick={addRow}
					data-test-id="recipe-add-ingredient"
					class="fl-press"
				>
					<Plus size={18} aria-hidden="true" />
					{t('recipes.addIngredient')}
				</Button>
			</div>
		{:else}
			<div class="space-y-4">
				<h2 class="text-h2 font-semibold">{t('recipes.step.steps')}</h2>
				<p class="text-muted-foreground text-caption">{t('recipes.stepsHint')}</p>

				<ol class="space-y-3" data-test-id="recipe-steps">
					{#each steps as _, index (index)}
						<li class="flex items-end gap-2">
							<div class="min-w-0 flex-1">
								<Label for="recipe-step-{index}">{t('recipes.stepBody', { rank: index + 1 })}</Label>
								<textarea
									id="recipe-step-{index}"
									bind:value={steps[index]}
									rows={2}
									data-test-class="recipe-step"
									class="border-input bg-background w-full rounded-md border p-2"
								></textarea>
							</div>
							<Button
								type="button"
								variant="outline"
								onclick={() => removeStep(index)}
								disabled={steps.length === 1}
								aria-label={t('recipes.removeStep', { rank: index + 1 })}
								data-test-class="recipe-step-remove"
								class="fl-press"
							>
								<Trash2 size={18} aria-hidden="true" />
							</Button>
						</li>
					{/each}
				</ol>

				<Button
					type="button"
					variant="outline"
					onclick={addStep}
					data-test-id="recipe-add-step"
					class="fl-press"
				>
					<Plus size={18} aria-hidden="true" />
					{t('recipes.addStep')}
				</Button>
			</div>
		{/if}

		<div class="flex flex-wrap items-stretch gap-2">
			{#if rank > 0}
				<Button
					type="button"
					variant="outline"
					onclick={goBack}
					data-test-id="recipe-back"
					class="fl-press"
				>
					<ChevronLeft size={18} aria-hidden="true" />
					{t('recipes.back')}
				</Button>
			{/if}

			<Button type="submit" data-test-id="recipe-next" class="fl-press">
				{#if isLast}
					<Check size={18} aria-hidden="true" />
					{t('common.save')}
				{:else}
					{t('recipes.next')}
					<ChevronRight size={18} aria-hidden="true" />
				{/if}
			</Button>

			<Button
				type="button"
				variant="outline"
				onclick={reset}
				data-test-id="recipe-cancel"
				class="fl-press"
			>
				{t('common.cancel')}
			</Button>
		</div>
	</form>
{/if}

{#if data.recipes.length === 0}
	<EmptyState illustration="cart" text={t('recipes.empty')} testId="recipes-empty" />
{:else}
	<!--
		A Pinterest-style wall, not a stack: a recipe is a photo before it is a document, and a single column
		of fully unfolded cards buried that photo under ingredients nobody was reading yet. `columns` packs
		cards of uneven height into that wall in plain CSS — `break-inside-avoid` on each card is what keeps
		one from being split across two columns, no masonry library needed. Column count follows this app's
		own `phone`/`full` breakpoints rather than an invented one: two on a phone or a portrait tablet, four
		once there is a real desktop-width landscape screen to fill.
	-->
	<ul class="fl-recipe-grid mt-6 columns-2 gap-3.5 full:columns-4">
		{#each data.recipes as recipe (recipe.id)}
			{@const ingredients = data.ingredientsOf(recipe.id)}
			{@const recipeSteps = data.stepsOf(recipe.id)}
			{@const isExpanded = expandedIds.has(recipe.id)}
			<li class="mb-3.5 break-inside-avoid">
				<Card.Root data-test-class="recipe-card" class="fl-home-card overflow-hidden p-0">
					<!--
						Collapsed, a card is only its photo (or its emoji, when there is none) and its name: nothing
						else is worth showing at rest in a wall this dense. The whole header is the summary's own
						toggle, so a tap anywhere on the photo or the name opens it, not only on a chevron nobody
						asked for.
					-->
					<button
						type="button"
						onclick={() => toggleExpanded(recipe.id)}
						aria-expanded={isExpanded}
						aria-controls="recipe-panel-{recipe.id}"
						data-test-class="recipe-card-header"
						class="fl-press block w-full text-left"
					>
						<RecipeCover recipeName={recipe.name} emoji={recipe.emoji} photoPath={recipe.photoPath} />
						<span class="flex items-start gap-2 p-3">
							<Card.Title class="text-product min-w-0 flex-1 break-words">{recipe.name}</Card.Title>
							<span
								class="bg-primary text-primary-foreground text-caption mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
							>
								<Users size={12} aria-hidden="true" />
								{recipe.servings}
							</span>
						</span>
					</button>

					{#if isExpanded}
						<div
							id="recipe-panel-{recipe.id}"
							data-test-class="recipe-card-panel"
							transition:slide={{ duration: motionMs(220), easing: cubicOut }}
						>
							<Card.Content class="border-t pt-4">
								<RecipePhoto
									recipeId={recipe.id}
									recipeName={recipe.name}
									ingredientNames={ingredients.map((line) => line.name)}
									photoPath={recipe.photoPath}
								/>

								{#if ingredients.length}
									<h3
										class="text-label text-muted-foreground flex items-center gap-1.5 font-semibold tracking-wide uppercase"
									>
										<ShoppingBasket size={14} aria-hidden="true" />
										{t('recipes.step.ingredients')}
									</h3>
									<ul class="text-label mt-2 space-y-1.5">
										{#each ingredients as ingredient (ingredient.id)}
											<li
												data-test-class="recipe-ingredient"
												class="flex items-baseline gap-2 border-b border-dashed pb-1.5 last:border-0 last:pb-0"
											>
												<span class="min-w-0 flex-1">{ingredient.name}</span>
												{#if ingredient.qty}
													<span class="text-muted-foreground text-caption shrink-0 font-medium">
														{ingredient.qty}
														{t(`units.${ingredient.unit}`)}
													</span>
												{/if}
											</li>
										{/each}
									</ul>
								{/if}

								{#if recipeSteps.length}
									<h3
										class="text-label text-muted-foreground mt-5 flex items-center gap-1.5 font-semibold tracking-wide uppercase"
									>
										<CookingPot size={14} aria-hidden="true" />
										{t('recipes.step.steps')}
									</h3>
									<!--
										"Cooking mode" reading: a step is looked at with wet or floury hands, from arm's
										length, one at a time — so the number carries the weight, not the bullet.
									-->
									<ol class="mt-2 space-y-3">
										{#each recipeSteps as step, index (step.id)}
											<li data-test-class="recipe-step-body" class="flex items-start gap-3">
												<span
													class="bg-muted text-foreground text-label grid size-7 shrink-0 place-items-center rounded-full font-bold"
													aria-hidden="true"
												>
													{index + 1}
												</span>
												<span class="text-label pt-0.5">{step.body}</span>
											</li>
										{/each}
									</ol>
								{/if}

								<div class="mt-4 flex flex-wrap items-center gap-3">
									<Button
										onclick={() => toggleGeneration(recipe.id)}
										disabled={ingredients.length === 0}
										data-test-class="recipe-generate"
										class="fl-press"
									>
										<ShoppingBasket size={18} aria-hidden="true" />
										{t('recipes.generate')}
									</Button>

									<Button
										variant="outline"
										onclick={() => edit(recipe)}
										aria-label={t('recipes.edit', { name: recipe.name })}
										data-test-class="recipe-edit"
										class="fl-press"
									>
										<Pencil size={18} aria-hidden="true" />
										{t('common.edit')}
									</Button>

									<Button
										variant="destructive"
										onclick={() => (toDelete = toDelete === recipe.id ? null : recipe.id)}
										aria-label={t('recipes.delete', { name: recipe.name })}
										data-test-class="recipe-delete"
										class="fl-press"
									>
										<Trash2 size={18} aria-hidden="true" />
										{t('common.delete')}
									</Button>
								</div>

								<!--
									Generation sits under the recipe it is about, not in a dialog: you read the ingredients again while
									deciding how many people you are cooking for.
								-->
								{#if generatingFor === recipe.id}
									<div class="mt-4 space-y-3 border-t pt-4" data-test-class="recipe-generate-form">
										<div>
											<Label for="generate-people-{recipe.id}">{t('recipes.people')}</Label>
											<IconField icon={Users}>
												<Input
													id="generate-people-{recipe.id}"
													type="number"
													bind:value={guestCount}
													min={MIN_SERVINGS}
													max={MAX_SERVINGS}
													data-test-class="generate-people"
												/>
											</IconField>
											<p class="text-muted-foreground text-caption">
												{t('recipes.peopleHint', { servings: recipe.servings })}
											</p>
										</div>

										<div>
											<Label for="generate-target-{recipe.id}">{t('recipes.target')}</Label>
											<IconField icon={Hash}>
												<select
													id="generate-target-{recipe.id}"
													bind:value={target}
													data-test-class="generate-target"
													class="border-input bg-background min-h-[max(2.75rem,44px)] w-full rounded-md border"
												>
													<option value="">{t('recipes.targetNew')}</option>
													{#each data.lists as list (list.id)}
														<option value={list.id}>{list.emoji} {list.name}</option>
													{/each}
												</select>
											</IconField>
										</div>

										<Button
											onclick={() => generate(recipe.id)}
											data-test-class="generate-submit"
											class="fl-press"
										>
											<ShoppingBasket size={18} aria-hidden="true" />
											{t('recipes.generateSubmit')}
										</Button>
									</div>
								{/if}

								{#if toDelete === recipe.id}
									<div class="mt-4 space-y-3 border-t pt-4">
										<p class="text-label">{t('recipes.deleteConfirm', { name: recipe.name })}</p>
										<div class="flex flex-wrap gap-2">
											<Button
												variant="destructive"
												onclick={() => remove(recipe.id)}
												data-test-class="recipe-delete-confirm"
												class="fl-press"
											>
												{t('recipes.deleteYes')}
											</Button>
											<Button variant="outline" onclick={() => (toDelete = null)} class="fl-press">
												{t('common.cancel')}
											</Button>
										</div>
									</div>
								{/if}
							</Card.Content>
						</div>
					{/if}
				</Card.Root>
			</li>
		{/each}
	</ul>
{/if}

<EmojiPicker bind:this={picker} value={emoji} onpick={(chosen) => (emoji = chosen)} />
