/**
 * What the central button has just asked for, for the time it takes to reach the screen concerned.
 *
 * The shop, aisle and card forms are already sitting permanently on their page: you only have to go there
 * and put the cursor in the first field. That of a new list, for its part, is folded — the screen has to
 * know we are coming in order to unfold it. A new recipe goes through "Create a recipe" and its own relay
 * (`recipeDraft`), since what unfolds there is already a draft. Hence this relay, rather than a URL
 * parameter that would stay in the address bar and reopen the form on every reload.
 */
export type CreateKind = 'item' | 'list' | 'aisle' | 'shop' | 'card' | 'recipe' | 'mealPlan';

class CreateIntent {
	#kind = $state<CreateKind | null>(null);

	get kind() {
		return this.#kind;
	}

	request(kind: CreateKind) {
		this.#kind = kind;
	}

	/**
	 * True only once: the first screen recognising the intent consumes it. Without that, going back to the
	 * home screen would reopen the form when nobody asked for it.
	 */
	take(kind: CreateKind) {
		if (this.#kind !== kind) return false;
		this.#kind = null;
		return true;
	}
}

export const createIntent = new CreateIntent();
