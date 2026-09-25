import type { RecipeDraft } from '$domain/recipe-draft';

/**
 * The draft a "Create a recipe" source has just produced, for the time it takes to reach the recipes
 * screen and unfold the form on it (#311). Same relay as `createIntent`, for the same reason: a URL
 * parameter would stay in the address bar and reopen the form on every reload — and a draft read from a
 * page or an AI answer does not fit in one anyway.
 */
class RecipeDraftRelay {
	#draft = $state<RecipeDraft | null>(null);

	offer(draft: RecipeDraft) {
		this.#draft = draft;
	}

	/** Consumed once, so going back to the recipes later does not reopen a form nobody asked for. */
	take(): RecipeDraft | null {
		const draft = this.#draft;
		this.#draft = null;
		return draft;
	}
}

export const recipeDraft = new RecipeDraftRelay();
