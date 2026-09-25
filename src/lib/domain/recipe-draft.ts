import { DEFAULT_SERVINGS, type RecipeLine } from './recipe';
import { DEFAULT_UNIT } from './units';
import { guessLinks } from './step-ingredients';
import { importedLines, parseImportedServings, type ImportedRecipe } from './recipe-import';
import type { SuggestedRecipe } from './ai-recipe';

export const DEFAULT_EMOJI = '🍲';

/**
 * What every way of creating a recipe hands to the recipe form (#311), and nothing more: typed by hand,
 * read from a link, a photo or the AI, a recipe always lands in the same editable form, and only the form
 * saves. A source that wrote to the database on its own would be the one place a recipe enters the
 * household without being read first.
 *
 * `reviewed` says the content came from elsewhere, so the form must ask for a careful read before saving.
 */
export interface RecipeDraft {
	name: string;
	emoji: string;
	servings: number;
	lines: RecipeLine[];
	steps: string[];
	stepIngredients: number[][];
	imagePrompt?: string;
	image: string | null;
	reviewed: boolean;
}

function emptyLine(): RecipeLine {
	return { name: '', qty: '', unit: DEFAULT_UNIT };
}

export function emptyDraft(): RecipeDraft {
	return {
		name: '',
		emoji: DEFAULT_EMOJI,
		servings: DEFAULT_SERVINGS,
		lines: [emptyLine()],
		steps: [''],
		stepIngredients: [[]],
		image: null,
		reviewed: false
	};
}

/**
 * A recipe read from a web page. The quantities are split as best we can, some lines come back as they
 * are, and the number of servings is sometimes missing: the person reads it and corrects it in the form.
 */
export function draftFromImport(recipe: ImportedRecipe): RecipeDraft {
	const lines = importedLines(recipe.ingredients);
	const filled = lines.length ? lines : [emptyLine()];

	return {
		name: recipe.name ?? '',
		emoji: DEFAULT_EMOJI,
		servings: parseImportedServings(recipe.servings) ?? DEFAULT_SERVINGS,
		lines: filled,
		steps: recipe.steps.length ? recipe.steps : [''],
		stepIngredients: recipe.steps.length
			? guessLinks(
					filled.map((line) => line.name),
					recipe.steps
				)
			: [[]],
		image: recipe.image,
		reviewed: true
	};
}

/** A recipe drafted by the AI, from a request, a photo, a page's text or what the household bought. */
export function draftFromSuggestion(recipe: SuggestedRecipe): RecipeDraft {
	return {
		name: recipe.name,
		emoji: recipe.emoji,
		servings: recipe.servings,
		lines: recipe.ingredients.length ? recipe.ingredients : [emptyLine()],
		steps: recipe.steps.length ? recipe.steps : [''],
		stepIngredients: recipe.steps.length ? recipe.stepIngredients : [[]],
		imagePrompt: recipe.imagePrompt,
		image: null,
		reviewed: true
	};
}
