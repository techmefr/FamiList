/**
 * One active circle, among several read at the same time.
 *
 * The account belongs to as many circles as it likes — the family, the partner, colleagues — and the
 * cache holds them all: that is what makes switching instant and usable offline, and what lets realtime
 * place an item from a circle nobody is looking at.
 *
 * What is read everywhere is not shown everywhere for all that. One circle is active at a time, and it
 * decides both what the screen shows and where what you create lands. Three reasons, in order:
 *
 * - aisles are specific to each circle, and carry distinct ids for identical names. Merging them would
 *   give two "Fruit and vegetables" in the same sorting screen, and automatic detection would pick one of
 *   the two at random;
 * - the learned route lives in a shop, therefore in a circle. Mixing shops would sort a family list along
 *   a route learned at work;
 * - creating a list, a shop or a card needs a target circle anyway. A merged display would mean asking
 *   for it on every gesture, instead of once.
 *
 * The personal list is the only exception, and it is in the model: it has no circle, so none can hide it.
 * It follows its author from one circle to another.
 */

export interface CircleScoped {
	householdId?: string;
}

export interface Named {
	id: string;
	name: string;
}

/** What belongs to the active circle, and nothing else. */
export const ofCircle = <T extends CircleScoped>(rows: readonly T[], circle: string): T[] =>
	circle === '' ? [] : rows.filter((row) => row.householdId === circle);

/**
 * The visible lists: those of the active circle, and the personal ones, which have none.
 *
 * Without the second term, sharing a list would make it appear and switching circle would make it
 * disappear — although nobody closed it.
 */
export const visibleLists = <T extends CircleScoped>(lists: readonly T[], circle: string): T[] =>
	lists.filter((list) => !list.householdId || list.householdId === circle);

export interface RecipeShared {
	id: string;
	householdId: string;
}

export interface RecipeShareRow {
	recipeId: string;
	householdId: string;
}

/**
 * The visible recipes: those owned by the active circle, and those shared into it by another circle the
 * account also belongs to.
 *
 * Unlike a personal list, a shared recipe never loses its `householdId` — sharing does not reassign it, it
 * only adds a row to `recipe_shares`. So the owned half is filtered the same way as every other circle
 * table (`ofCircle`), and the shared-in half is found by matching that join table instead of by an absent
 * `householdId`.
 */
export const visibleRecipes = <T extends RecipeShared>(
	recipes: readonly T[],
	shares: readonly RecipeShareRow[],
	circle: string
): T[] => {
	if (circle === '') return [];
	const sharedInIds = new Set(
		shares.filter((share) => share.householdId === circle).map((share) => share.recipeId)
	);
	return recipes.filter((recipe) => recipe.householdId === circle || sharedInIds.has(recipe.id));
};

/**
 * The aisle to show for an item.
 *
 * A personal list crosses circles, its items keep the aisle of the circle they were typed in, and that
 * aisle does not exist in the neighbouring circle. We then sort them into the aisle detection suggests
 * here rather than let them fall into a nameless group at the end of the list. Nothing is rewritten:
 * coming back to the original circle finds the original arrangement.
 */
export const resolveAisle = (
	aisleId: string,
	known: ReadonlySet<string>,
	suggested: string
): string => (known.has(aisleId) ? aisleId : suggested);

/**
 * The circle to show on opening: the one you were looking at, if it is still ours.
 *
 * We may have been removed from it on another device; we then fall back on the oldest rather than on an
 * empty screen describing a circle we no longer belong to.
 */
export const defaultCircle = (circles: readonly Named[], remembered: string | null): string => {
	if (remembered && circles.some((circle) => circle.id === remembered)) return remembered;
	return circles[0]?.id ?? '';
};
