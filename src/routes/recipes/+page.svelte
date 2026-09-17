<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '$db/supabase';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { createIntent } from '$stores/create.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { DEFAULT_SERVINGS, MAX_SERVINGS, MIN_SERVINGS, type RecipeLine } from '$domain/recipe';
	import {
		importErrorOf,
		importedLines,
		parseImportedServings,
		type ImportError,
		type ImportedRecipe
	} from '$domain/recipe-import';
	import { UNITS, DEFAULT_UNIT } from '$domain/units';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import EmojiPicker from '$components/app/EmojiPicker.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';
	import IconField from '$components/app/IconField.svelte';
	import RecipeSuggestion from '$components/app/RecipeSuggestion.svelte';
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
		Download
	} from '@lucide/svelte';

	/**
	 * The three stages of typing. A whole recipe rarely fits on a phone screen, and asking everything at
	 * once — the name, ten ingredients, six steps — gives a form you close before starting it. So we ask
	 * what it is, then what to buy, then how you go about it: the order a recipe is really written in.
	 *
	 * The steps are an array and not three booleans: the indicator at the top is then derived from the same
	 * state as the content, and neither can drift from the other.
	 */
	const ETAPES = ['recette', 'ingredients', 'etapes'] as const;
	type Etape = (typeof ETAPES)[number];

	const EMOJI_PAR_DEFAUT = '🍲';

	let creating = $state(false);
	let etape = $state<Etape>('recette');
	let picker = $state<EmojiPicker | null>(null);

	let name = $state('');
	let emoji = $state(EMOJI_PAR_DEFAUT);
	let servings = $state(DEFAULT_SERVINGS);
	let lines = $state<RecipeLine[]>([{ name: '', qty: '', unit: DEFAULT_UNIT }]);
	let steps = $state<string[]>(['']);

	/** The recipe whose generation is unfolded, and what is being asked of it. */
	let genere = $state<string | null>(null);
	let convives = $state(DEFAULT_SERVINGS);
	let cible = $state('');
	let aSupprimer = $state<string | null>(null);

	/** The import from a link: the address typed, the wait, the refusal, and the fact of having served. */
	let lien = $state('');
	let importEnCours = $state(false);
	let importRefus = $state<ImportError | null>(null);
	let importe = $state(false);

	const rang = $derived(ETAPES.indexOf(etape));
	const derniere = $derived(rang === ETAPES.length - 1);

	// The central button brings you here to create: the form must already be unfolded on arrival.
	$effect(() => {
		if (createIntent.take('recipe')) ouvrir();
	});

	function ouvrir() {
		creating = true;
		etape = 'recette';
	}

	function reset() {
		creating = false;
		etape = 'recette';
		name = '';
		emoji = EMOJI_PAR_DEFAUT;
		servings = DEFAULT_SERVINGS;
		lines = [{ name: '', qty: '', unit: DEFAULT_UNIT }];
		steps = [''];
		importe = false;
		importRefus = null;
	}

	/**
	 * The reason for refusal returned by the edge function.
	 *
	 * `functions.invoke` does not throw on a 4xx: it returns an error carrying the HTTP response in
	 * `context`. Without re-reading it, every refusal would look alike — "unreadable address" and "no
	 * recipe on this page" call for two opposite gestures.
	 */
	async function motifDuRefus(erreur: unknown): Promise<ImportError> {
		const contexte = (erreur as { context?: unknown } | null)?.context;
		if (!(contexte instanceof Response)) return 'unreachable';

		try {
			const corps = await contexte.json();
			return importErrorOf(corps?.error);
		} catch {
			return 'unreachable';
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
	function preRemplir(recette: ImportedRecipe) {
		const importees = importedLines(recette.ingredients);

		name = recette.name ?? '';
		emoji = EMOJI_PAR_DEFAUT;
		servings = parseImportedServings(recette.servings) ?? DEFAULT_SERVINGS;
		lines = importees.length ? importees : [{ name: '', qty: '', unit: DEFAULT_UNIT }];
		steps = recette.steps.length ? recette.steps : [''];

		creating = true;
		etape = 'recette';
		importe = true;
		lien = '';
	}

	async function importer(event: SubmitEvent) {
		event.preventDefault();

		const url = lien.trim();
		if (!url || importEnCours) return;

		importEnCours = true;
		importRefus = null;

		try {
			const { data: recette, error } = await supabase.functions.invoke<ImportedRecipe>(
				'import-recipe',
				{ body: { url } }
			);

			if (error || !recette) {
				importRefus = await motifDuRefus(error);
				return;
			}

			feedback.play('add');
			preRemplir(recette);
		} catch {
			// Offline, or function unavailable: for whoever is looking at the screen, it is the same thing.
			importRefus = 'unreachable';
		} finally {
			importEnCours = false;
		}
	}

	/**
	 * The form opens on a single row, and a button adds more, rather than an empty row appearing as soon as
	 * you fill the last one. A recipe has three ingredients as often as fifteen: a form that lengthens on
	 * its own while you type moves what you are reading, and announces nothing to a screen reader.
	 *
	 * The last row cannot be removed: an ingredient form with no field can no longer be filled, and it
	 * would take a second button to make one reappear.
	 */
	function ajouterLigne() {
		lines = [...lines, { name: '', qty: '', unit: DEFAULT_UNIT }];
	}

	function retirerLigne(index: number) {
		lines = lines.length > 1 ? lines.filter((_, i) => i !== index) : lines;
	}

	function ajouterEtape() {
		steps = [...steps, ''];
	}

	function retirerEtape(index: number) {
		steps = steps.length > 1 ? steps.filter((_, i) => i !== index) : steps;
	}

	function reculer() {
		if (rang > 0) etape = ETAPES[rang - 1];
	}

	/**
	 * The same button moves on a stage or saves, depending on where you are. A single `submit` for both:
	 * the Enter key then does what you expect of it at each step, which a "next" button outside the form
	 * would not give.
	 */
	function avancer(event: SubmitEvent) {
		event.preventDefault();

		if (!derniere) {
			etape = ETAPES[rang + 1];
			return;
		}

		if (!name.trim()) return;

		feedback.play('add');
		data.addRecipe({ name, emoji, servings, ingredients: lines, steps });
		reset();
	}

	function supprimer(id: string) {
		feedback.play('remove');
		data.removeRecipe(id);
		aSupprimer = null;
		if (genere === id) genere = null;
	}

	function deplierGeneration(recipeId: string) {
		if (genere === recipeId) {
			genere = null;
			return;
		}

		genere = recipeId;
		// We start from the recipe's own number of servings: most of the time you cook for that number, and the
		// field is then already right.
		convives = data.recipe(recipeId)?.servings ?? DEFAULT_SERVINGS;
		cible = '';
	}

	async function generer(recipeId: string) {
		const issue = data.generateList(recipeId, convives, cible || undefined);
		if (!issue) return;

		feedback.play('add');
		genere = null;
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

{#if !creating}
	<Button onclick={ouvrir} data-test-id="recipe-new" class="fl-press mt-4">
		<Plus size={18} aria-hidden="true" />
		{t('create.recipe')}
	</Button>

	<!-- Only appears if an AI key is set in the settings; otherwise, nothing at all. -->
	<RecipeSuggestion />

	<!--
		The import from a link, placed under manual creation and not in its place: a family recipe comes from
		no web page, and that is what this screen serves first.

		What the address reveals is written in plain words above the field. The application is served
		statically and talks to nobody but its own database; fetching a third-party page means entrusting that
		address to the instance's server, which will introduce itself to the site visited. It is the project's
		first way out to the network, it only leaves on an explicit gesture, and saying so costs less than
		letting it be discovered.
	-->
	<form onsubmit={importer} class="bg-card mt-4 space-y-3 rounded-xl border p-4">
		<h2 class="text-h2 font-semibold">{t('recipes.import.title')}</h2>
		<p class="text-muted-foreground text-caption">{t('recipes.import.privacy')}</p>

		<div>
			<Label for="recipe-import-url">{t('recipes.import.url')}</Label>
			<IconField icon={Link2}>
				<Input
					id="recipe-import-url"
					type="url"
					bind:value={lien}
					data-test-id="recipe-import-url"
					placeholder={t('recipes.import.urlPlaceholder')}
				/>
			</IconField>
		</div>

		<Button
			type="submit"
			variant="outline"
			disabled={importEnCours || !lien.trim()}
			data-test-id="recipe-import-submit"
			class="fl-press"
		>
			<Download size={18} aria-hidden="true" />
			{importEnCours ? t('recipes.import.loading') : t('recipes.import.submit')}
		</Button>

		<!--
			The refusal is announced, not only displayed: the person has just pasted an address and is looking at
			the field, not at the bottom of the block.
		-->
		<p class="text-caption text-destructive" role="alert" data-test-id="recipe-import-error">
			{#if importRefus}
				{t(`recipes.import.error.${importRefus}`)}
			{/if}
		</p>

		<p class="text-muted-foreground text-caption">{t('recipes.import.social')}</p>
	</form>
{:else}
	<form onsubmit={avancer} class="bg-card mt-4 space-y-5 rounded-xl border p-4">
		{#if importe}
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
			{#each ETAPES as id, index (id)}
				<li
					class="text-caption rounded-full border px-3 py-1 {etape === id
						? 'bg-[var(--fl-primary-tint)] text-primary border-transparent font-semibold'
						: 'text-muted-foreground'}"
					aria-current={etape === id ? 'step' : undefined}
				>
					{index + 1}. {t(`recipes.step.${id}`)}
				</li>
			{/each}
		</ol>

		{#if etape === 'recette'}
			<div class="space-y-4">
				<h2 class="text-h2 font-semibold">{t('recipes.step.recette')}</h2>

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
		{:else if etape === 'ingredients'}
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
									onclick={() => retirerLigne(index)}
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
					onclick={ajouterLigne}
					data-test-id="recipe-add-ingredient"
					class="fl-press"
				>
					<Plus size={18} aria-hidden="true" />
					{t('recipes.addIngredient')}
				</Button>
			</div>
		{:else}
			<div class="space-y-4">
				<h2 class="text-h2 font-semibold">{t('recipes.step.etapes')}</h2>
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
								onclick={() => retirerEtape(index)}
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
					onclick={ajouterEtape}
					data-test-id="recipe-add-step"
					class="fl-press"
				>
					<Plus size={18} aria-hidden="true" />
					{t('recipes.addStep')}
				</Button>
			</div>
		{/if}

		<div class="flex flex-wrap items-stretch gap-2">
			{#if rang > 0}
				<Button
					type="button"
					variant="outline"
					onclick={reculer}
					data-test-id="recipe-back"
					class="fl-press"
				>
					<ChevronLeft size={18} aria-hidden="true" />
					{t('recipes.back')}
				</Button>
			{/if}

			<Button type="submit" data-test-id="recipe-next" class="fl-press">
				{#if derniere}
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
	<ul class="mt-6 space-y-3">
		{#each data.recipes as recipe (recipe.id)}
			{@const ingredients = data.ingredientsOf(recipe.id)}
			{@const etapesRecette = data.stepsOf(recipe.id)}
			<li>
				<Card.Root data-test-class="recipe-card">
					<Card.Header>
						<Card.Title class="text-product break-words">
							<span aria-hidden="true">{recipe.emoji}</span>
							{recipe.name}
						</Card.Title>
						<Card.Description>
							{t('recipes.servingsCount', { count: recipe.servings })}
						</Card.Description>
					</Card.Header>

					<Card.Content>
						{#if ingredients.length}
							<h3 class="text-label font-medium">{t('recipes.step.ingredients')}</h3>
							<ul class="text-label text-muted-foreground mt-1 space-y-1">
								{#each ingredients as ingredient (ingredient.id)}
									<li data-test-class="recipe-ingredient">
										{ingredient.name}
										{#if ingredient.qty}
											— {ingredient.qty}
											{t(`units.${ingredient.unit}`)}
										{/if}
									</li>
								{/each}
							</ul>
						{/if}

						{#if etapesRecette.length}
							<h3 class="text-label mt-4 font-medium">{t('recipes.step.etapes')}</h3>
							<ol class="text-label text-muted-foreground mt-1 list-decimal space-y-1 ps-5">
								{#each etapesRecette as step (step.id)}
									<li data-test-class="recipe-step-body">{step.body}</li>
								{/each}
							</ol>
						{/if}

						<div class="mt-4 flex flex-wrap items-center gap-3">
							<Button
								variant="outline"
								onclick={() => deplierGeneration(recipe.id)}
								disabled={ingredients.length === 0}
								data-test-class="recipe-generate"
								class="fl-press"
							>
								<ShoppingBasket size={18} aria-hidden="true" />
								{t('recipes.generate')}
							</Button>

							<Button
								variant="outline"
								onclick={() => (aSupprimer = aSupprimer === recipe.id ? null : recipe.id)}
								aria-label={t('recipes.delete', { name: recipe.name })}
								data-test-class="recipe-delete"
								class="fl-press"
							>
								<Trash2 size={18} aria-hidden="true" />
							</Button>
						</div>

						<!--
							Generation sits under the recipe it is about, not in a dialog: you read the ingredients again while
							deciding how many people you are cooking for.
						-->
						{#if genere === recipe.id}
							<div class="mt-4 space-y-3 border-t pt-4" data-test-class="recipe-generate-form">
								<div>
									<Label for="generate-people-{recipe.id}">{t('recipes.people')}</Label>
									<IconField icon={Users}>
										<Input
											id="generate-people-{recipe.id}"
											type="number"
											bind:value={convives}
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
											bind:value={cible}
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
									onclick={() => generer(recipe.id)}
									data-test-class="generate-submit"
									class="fl-press"
								>
									<ShoppingBasket size={18} aria-hidden="true" />
									{t('recipes.generateSubmit')}
								</Button>
							</div>
						{/if}

						{#if aSupprimer === recipe.id}
							<div class="mt-4 space-y-3 border-t pt-4">
								<p class="text-label">{t('recipes.deleteConfirm', { name: recipe.name })}</p>
								<div class="flex flex-wrap gap-2">
									<Button
										variant="outline"
										onclick={() => supprimer(recipe.id)}
										data-test-class="recipe-delete-confirm"
										class="fl-press"
									>
										{t('recipes.deleteYes')}
									</Button>
									<Button variant="outline" onclick={() => (aSupprimer = null)} class="fl-press">
										{t('common.cancel')}
									</Button>
								</div>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</li>
		{/each}
	</ul>
{/if}

<EmojiPicker bind:this={picker} value={emoji} onpick={(chosen) => (emoji = chosen)} />
