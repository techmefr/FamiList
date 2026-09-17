/**
 * The contents of the guided tour: which screen tells what, and in which order.
 *
 * Nothing here touches the document. The part that depends on the browser — knowing whether a marker is
 * really visible, and driving driver.js — lives in `$lib/tour`, and only comes down on demand. Separating
 * the two makes it possible to check the choice of steps without a browser, where a test render could not
 * say what is visible anyway.
 */
export interface TourStep {
	/**
	 * The marker aimed at. Always a `data-test-id` already in place: a selector invented for the tour
	 * disappears at the first rework, and nobody notices.
	 */
	selector: string;
	/** The root of the two translation keys, `tour.<key>Title` and `tour.<key>Body`. */
	key: string;
}

/**
 * The overview tour: what the navigation bar carries. It is the one for the first opening, and the one we
 * fall back to on a screen with nothing particular to explain.
 */
export const NAV_STEPS: TourStep[] = [
	{ selector: '[data-test-id="nav-create"]', key: 'create' },
	{ selector: '[data-test-id="nav-/magnifier"]', key: 'magnifier' },
	{ selector: '[data-test-id="nav-/chat"]', key: 'chat' },
	{ selector: '[data-test-id="nav-/shops"]', key: 'shops' },
	{ selector: '[data-test-id="nav-/cards"]', key: 'cards' },
	// The profile is in the column on a large screen and in the header on a phone. Two markers, one step:
	// `pickSteps` keeps the one that is visible and drops the other.
	{ selector: '[data-test-id="nav-/profile"]', key: 'profile' },
	{ selector: '[data-test-id="header-profile"]', key: 'profile' }
];

/**
 * What the question mark tells depending on the screen open.
 *
 * Help that always repeats the same thing is only read once. Somebody calling it from a shopping list is
 * not wondering where their loyalty cards are: they are wondering what the handle to the left of an aisle
 * does, or why half their list has disappeared.
 *
 * Two markers can carry the same key — the filters are reached through the thumb bar on a phone and
 * through the header button on a large screen. Whichever of the two is visible wins.
 */
export const SCREEN_STEPS: { test: RegExp; steps: TourStep[] }[] = [
	{
		test: /^\/l\/[^/]+$/,
		steps: [
			{ selector: '[data-test-id="route-hint"]', key: 'listRoute' },
			{ selector: '[data-test-id="thumb-bar"]', key: 'listFilters' },
			{ selector: '[data-test-id="open-filters"]', key: 'listFilters' },
			{ selector: '[data-test-id="open-share"]', key: 'listShare' },
			{ selector: '[data-test-id="open-chat"]', key: 'listChat' }
		]
	},
	{ test: /^\/shops/, steps: [{ selector: '[data-test-id="add-aisle"]', key: 'shopsAisles' }] },
	{ test: /^\/cards/, steps: [{ selector: '[data-test-id="import-code"]', key: 'cardsScan' }] },
	{
		test: /^\/magnifier/,
		steps: [
			{ selector: '[data-test-id="magnifier-slider"]', key: 'magnifierZoom' },
			{ selector: '[data-test-id="magnifier-freeze"]', key: 'magnifierFreeze' }
		]
	},
	{
		test: /^\/profile/,
		steps: [{ selector: '[data-test-id="go-household"]', key: 'profileHousehold' }]
	}
];

/**
 * The candidate steps for this path.
 *
 * An unknown screen — the household, the admin panel, a page added tomorrow — falls back on the navigation
 * bar: better to say again where things are than to answer nothing to somebody asking for help.
 */
export function screenSteps(pathname: string): TourStep[] {
	return SCREEN_STEPS.find((entry) => entry.test.test(pathname))?.steps ?? NAV_STEPS;
}

/** The steps kept: those that are visible, one per subject, in the original order. */
export function pickSteps(steps: TourStep[], isVisible: (selector: string) => boolean): TourStep[] {
	const seen = new Set<string>();

	return steps.filter((step) => {
		if (seen.has(step.key) || !isVisible(step.selector)) return false;

		seen.add(step.key);
		return true;
	});
}
