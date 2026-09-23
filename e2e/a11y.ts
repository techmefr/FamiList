import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import pkg from '../package.json' with { type: 'json' };

const appVersion: string = pkg.version;

/**
 * The rules kept are those matching the RGAA criteria a machine can verify: contrast, field labels,
 * accessible names, heading structure, ARIA roles. RGAA does not stop there — this guardrail proves nothing
 * beyond the absence of regression on that subset.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const BASELINE_PATH = fileURLToPath(new URL('./a11y-baseline.json', import.meta.url));

/** Number of violations tolerated per screen and per rule, as observed at the time of adding it. */
type Baseline = Record<string, Record<string, number>>;

/**
 * `A11Y_UPDATE_BASELINE=1 pnpm exec playwright test a11y --workers=1` rewrites the baseline from the
 * current state. A single worker: the tests all write to the same file. Only to be run to record a new
 * screen or to accept a fix — never to silence a regression.
 */
const isUpdating = process.env.A11Y_UPDATE_BASELINE === '1';

const readBaseline = (): Baseline => JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline;

/**
 * The guided tour and the welcome screen open on the first visit and cover the page: axe would then only
 * analyse their overlay. `changedAt` is essential, otherwise the appearance sync that follows sign-in
 * overwrites this setting. The changelog modal is the same story: an unseen version pops a native
 * `<dialog>` that steals every click behind it, so `lastSeenChangelogVersion` is pre-set to the app's own
 * current version.
 */
export async function presetAppearance(
	page: Page,
	extra: Record<string, string> = {}
): Promise<void> {
	await page.addInitScript(
		settings => {
			localStorage.setItem('familist:appearance', JSON.stringify(settings));
		},
		{
			hasSeenTour: true,
			hasSeenWelcome: true,
			lastSeenChangelogVersion: appVersion,
			changedAt: Date.now(),
			...extra
		}
	);
}

interface ScanResult {
	counts: Record<string, number>;
	details: string[];
}

async function scan(page: Page): Promise<ScanResult> {
	const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();

	const counts: Record<string, number> = {};
	const details: string[] = [];

	for (const violation of violations) {
		counts[violation.id] = violation.nodes.length;
		details.push(`${violation.id} (${violation.impact}) x${violation.nodes.length}`);
	}

	return { counts, details };
}

/**
 * Compares the screen to its baseline rather than to zero. The application already has shortcomings on the
 * day this guardrail arrives; failing on them would make CI permanently red, and a permanently red CI is
 * switched off within a week. What must fail is a regression: a rule that was not violated, or that now is
 * more often.
 */
export async function expectNoNewViolations(page: Page, screen: string): Promise<void> {
	const { counts, details } = await scan(page);

	if (isUpdating) {
		const baseline = readBaseline();
		baseline[screen] = counts;
		writeFileSync(
			BASELINE_PATH,
			`${JSON.stringify(Object.fromEntries(Object.entries(baseline).sort()), null, '\t')}\n`
		);
		console.log(`[a11y] ${screen}: ${details.join(', ') || 'aucune violation'}`);
		return;
	}

	const tolerated = readBaseline()[screen] ?? {};
	const regressions = Object.entries(counts)
		.filter(([rule, count]) => count > (tolerated[rule] ?? 0))
		.map(([rule, count]) => `${rule}: ${count} (toléré ${tolerated[rule] ?? 0})`);

	expect(regressions, `Nouvelles violations d'accessibilité sur « ${screen} »`).toEqual([]);
}
