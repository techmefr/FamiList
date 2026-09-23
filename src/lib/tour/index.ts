import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { t } from '$i18n/index.svelte';
import { settings } from '$stores/settings.svelte';
import { pickSteps, screenSteps } from '$domain/tour';

/**
 * Present in the document is not enough: it has to be visible.
 *
 * Half the targeted landmarks exist at both screen sizes and only show one — the Magnifier tab is hidden on
 * a large screen, the filter button has a thumb version and a header one. `querySelector` finds them all
 * the same, and driver.js would then point at an empty rectangle in the corner of the page. A hidden
 * element has no rendered rectangle, which is exactly what we ask it for.
 */
function visible(selector: string): boolean {
	const element = document.querySelector(selector);
	return element instanceof HTMLElement && element.getClientRects().length > 0;
}

/**
 * Starts the tour of the current screen and records that it has been shown.
 *
 * The signal leaves on start, not on close. The reason is inside driver.js: its `onDestroyed` hook is only
 * called if the active element and step are both still known at closing time, and it is plainly skipped
 * otherwise. Relying on it let whole exits slip through, and a tour never marked as seen comes back at
 * every opening — turning help into an obstacle, exactly what we want to avoid.
 *
 * Shown therefore counts as seen, abandoning included. Someone who cut it by accident starts it again from
 * the question mark, which is there on every screen.
 */
export function startTour(pathname: string, onShown: () => void): boolean {
	const steps: DriveStep[] = pickSteps(screenSteps(pathname), visible).map((step) => ({
		element: step.selector,
		popover: {
			title: t(`tour.${step.key}Title`),
			description: t(`tour.${step.key}Body`)
		}
	}));

	// No target: the page is not the one we think, or it has not finished painting. We record nothing and
	// tell the caller so it can retry — driver.js does the same on the next attempt with fresh targets.
	if (steps.length === 0) return false;

	driver({
		steps,
		popoverClass: 'fl-tour',
		// Refused motion is already honoured by the CSS; saying it here too stops the bubble from gliding into
		// place, which no duration rule makes up for.
		animate: settings.animates,
		showProgress: steps.length > 1,
		allowClose: true,
		nextBtnText: t('tour.next'),
		prevBtnText: t('tour.back'),
		doneBtnText: t('tour.done'),
		progressText: t('tour.progress')
	}).drive();

	onShown();
	return true;
}
