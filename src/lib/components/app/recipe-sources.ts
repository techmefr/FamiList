import type { Component } from 'svelte';
import { Camera, Link2, NotebookPen, ScanText, ShoppingBasket, Sparkles } from '@lucide/svelte';
import { emptyDraft, type RecipeDraft } from '$domain/recipe-draft';
import RecipeLinkImport from '$components/app/RecipeLinkImport.svelte';
import RecipeScan from '$components/app/RecipeScan.svelte';
import AiRecipePhoto from '$components/app/AiRecipePhoto.svelte';
import AiRecipeRequest from '$components/app/AiRecipeRequest.svelte';
import RecipeSuggestion from '$components/app/RecipeSuggestion.svelte';

export type RecipeSourceId = 'manual' | 'link' | 'scan' | 'photo' | 'ai' | 'purchases';

interface SourceBase {
	id: RecipeSourceId;
	icon: Component;
	/** Goes through the person's own AI provider: the tile says so when no key is set, it does not vanish. */
	requiresAi: boolean;
}

/**
 * A source either opens its own panel, which ends by handing a draft over, or is the draft straight away —
 * typing a recipe by hand needs no intermediate screen, and one tap less matters on the most used path.
 */
export type RecipeSource =
	| (SourceBase & { panel: Component<{ onDraft: (draft: RecipeDraft) => void }> })
	| (SourceBase & { start: () => RecipeDraft });

/**
 * Every way of creating a recipe (#311), in the order the "Create a recipe" screen offers them. Adding one
 * is adding a line here and its component: the screen, its tiles and the hand-off to the form follow.
 *
 * Only sources the application can really carry out belong here: a tile leading nowhere would be a promise
 * the screen cannot keep.
 */
export const RECIPE_SOURCES: RecipeSource[] = [
	{ id: 'manual', icon: NotebookPen, requiresAi: false, start: emptyDraft },
	{ id: 'link', icon: Link2, requiresAi: false, panel: RecipeLinkImport },
	{ id: 'scan', icon: ScanText, requiresAi: false, panel: RecipeScan },
	{ id: 'photo', icon: Camera, requiresAi: true, panel: AiRecipePhoto },
	{ id: 'ai', icon: Sparkles, requiresAi: true, panel: AiRecipeRequest },
	{ id: 'purchases', icon: ShoppingBasket, requiresAi: true, panel: RecipeSuggestion }
];
