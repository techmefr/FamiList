import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Les règles retenues sont celles qui correspondent aux critères RGAA vérifiables par une machine :
 * contrastes, libellés de champs, noms accessibles, structure de titres, rôles ARIA. Le RGAA ne
 * s'arrête pas là — ce garde-fou ne prouve rien d'autre que l'absence de régression sur ce sous-
 * ensemble.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const BASELINE_PATH = fileURLToPath(new URL('./a11y-baseline.json', import.meta.url));

/** Nombre de violations tolérées par écran et par règle, tel qu'observé au moment de l'ajout. */
type Baseline = Record<string, Record<string, number>>;

/**
 * `A11Y_UPDATE_BASELINE=1 pnpm exec playwright test a11y --workers=1` réécrit la ligne de base à
 * partir de l'état courant. Un seul worker : les tests écrivent tous dans le même fichier. À ne
 * lancer que pour enregistrer un écran nouveau ou entériner une correction — jamais pour faire
 * taire une régression.
 */
const isUpdating = process.env.A11Y_UPDATE_BASELINE === '1';

const readBaseline = (): Baseline => JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline;

/**
 * Le tour guidé et l'écran de bienvenue s'ouvrent à la première visite et recouvrent la page : axe
 * n'analyserait alors que leur overlay. `changedAt` est indispensable, sinon la synchronisation
 * d'apparence qui suit la connexion réécrase ce réglage.
 */
export async function presetAppearance(
	page: Page,
	extra: Record<string, string> = {}
): Promise<void> {
	await page.addInitScript(
		settings => {
			localStorage.setItem('familist:appearance', JSON.stringify(settings));
		},
		{ hasSeenTour: true, hasSeenWelcome: true, changedAt: Date.now(), ...extra }
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
 * Compare l'écran à sa ligne de base plutôt qu'à zéro. L'application a déjà des manquements le jour
 * où ce garde-fou arrive ; échouer dessus rendrait la CI rouge en permanence, et une CI rouge en
 * permanence est désactivée en une semaine. Ce qui doit échouer, c'est une régression : une règle
 * qui n'était pas violée, ou qui l'est désormais plus souvent.
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
