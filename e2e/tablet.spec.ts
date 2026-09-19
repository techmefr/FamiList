import { test, expect } from './fixtures';

/**
 * The only tests played at a tablet-in-portrait viewport, and the `tablet` project of
 * `playwright.config.ts` plays only these. Mirrors `mobile.spec.ts`'s reasoning: replaying the whole
 * suite a third time would double the integration time to re-verify journeys that do not depend on
 * the screen; what really does depend on it lives here.
 *
 * 768x1024 is not a midpoint between the phone and the desktop layouts: per `app.css`, width >= 48rem
 * combined with a portrait orientation is its own `rail` regime — a narrow column fixed to one edge,
 * carrying the phone's set of destinations rather than the desktop's full column. It is also below the
 * 64rem + landscape threshold that turns on the mail-client list panel, so that split view does not
 * apply here and is intentionally not exercised by this spec.
 */

const RAIL_WIDTH_PX = 88; // --fl-rail-w: 5.5rem, at the default 16px root size.

test('sur tablette en portrait, la navigation est un rail sur le bord et non une barre ni une colonne pleine', async ({
	signedInPage: page
}) => {
	await page.goto('/');

	const bar = page.getByRole('navigation');
	const box = await bar.boundingBox();
	expect(box).not.toBeNull();

	const { width, height } = page.viewportSize()!;

	// A rail: fixed on an edge, full height, and far narrower than the `full` regime's 16rem column.
	expect(box!.height).toBeGreaterThan(height - 2);
	expect(box!.width).toBeLessThan(RAIL_WIDTH_PX + 8);
	expect(box!.width).toBeGreaterThan(RAIL_WIDTH_PX - 8);

	// Stuck to the right edge by default (right-handed): unlike the phone's bottom bar, it never spans
	// the full width.
	expect(box!.x + box!.width).toBeGreaterThan(width - 2);
	expect(box!.width).toBeLessThan(width / 3);

	// Same destination set as the phone: the magnifier has a rail entry, the household and the shops
	// do not — a narrow column has no room for nine destinations either.
	await expect(page.getByTestId('nav-/magnifier')).toBeVisible();
	await expect(page.getByTestId('nav-/household')).toBeHidden();
	await expect(page.getByTestId('nav-/shops')).toBeHidden();

	// What the rail no longer carries, the header carries: otherwise the profile would be unreachable.
	await expect(page.getByTestId('header-profile')).toBeVisible();
});

test('sur tablette en portrait, le bouton de création est dans le rail et ne flotte pas au-dessus du contenu', async ({
	signedInPage: page
}) => {
	await page.goto('/');

	// From 48rem the button rejoins the flow (Tailwind's `md:static`) instead of floating as a disc
	// above the bar — that floating behaviour is phone-only, verified separately in `mobile.spec.ts`.
	const button = page.getByTestId('nav-create');
	await expect(button).toBeVisible();

	const bar = await page.getByRole('navigation').boundingBox();
	const buttonBox = await button.boundingBox();
	expect(buttonBox).not.toBeNull();

	// Inside the rail's horizontal footprint, not overlapping the page content to its left.
	expect(buttonBox!.x).toBeGreaterThanOrEqual(bar!.x - 1);
	expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(bar!.x + bar!.width + 1);
});

test('sur tablette en portrait, le rail change de bord avec la main déclarée', async ({
	signedInPage: page
}) => {
	await page.goto('/profile');

	const width = page.viewportSize()!.width;
	const bar = page.getByRole('navigation');

	await page.locator('label:has([data-test-id="hand-right"])').click();
	await expect(page.getByTestId('hand-right')).toBeChecked();
	await expect(page.locator('html')).toHaveAttribute('data-hand', 'right');
	const droitier = await bar.boundingBox();
	expect(droitier!.x + droitier!.width).toBeGreaterThan(width - 2);

	await page.locator('label:has([data-test-id="hand-left"])').click();
	await expect(page.getByTestId('hand-left')).toBeChecked();
	await expect(page.locator('html')).toHaveAttribute('data-hand', 'left');
	const leftHanded = await bar.boundingBox();
	expect(leftHanded!.x).toBeLessThan(2);

	// Putting things back: the setting is saved on the fixed account, shared by the whole suite.
	await page.locator('label:has([data-test-id="hand-right"])').click();
	await expect(page.getByTestId('hand-right')).toBeChecked();
});

test('sur tablette en portrait, la vue liste+détail du grand écran ne s’affiche pas', async ({
	signedInPage: page
}) => {
	// The list panel only turns on from 64rem in landscape; a 768px-wide portrait tablet stays below
	// both conditions and must keep the single-column list, like a phone or a narrow desktop window.
	await page.goto('/');

	await expect(page.getByTestId('list-panel')).toBeHidden();
});
