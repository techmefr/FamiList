/**
 * A deliberately simple heuristic, taken from the prototype (flGuessAisle). It suggests an aisle when an
 * item is added, and the user can always change it. No network call, no model: a wrong guess costs a click,
 * latency costs the usage.
 */
const RULES: [RegExp, string][] = [
	[
		/tomate|salade|pomme|carotte|poireau|raisin|fruit|légume|legume|citron|oignon|herbe|persil|basilic|champignon|banane|courgette|concombre|pomme de terre/,
		'fruits'
	],
	[/pain|baguette|croissant|brioche|tarte|pâte feuillet|pate feuillet|viennoiser/, 'boulangerie'],
	[
		// "œuf" must be the start of a word, otherwise "bœuf" falls into the dairy aisle.
		/lait|yaourt|crème|creme|beurre|fromage|comté|comte|camembert|mozzarella|parmesan|(?<![a-zà-ÿ])(œuf|oeuf)/,
		'laitier'
	],
	[
		/poisson|saumon|cabillaud|crevette|poulet|bœuf|boeuf|porc|jambon|viande|steak|dinde|thon/,
		'viande'
	],
	[
		/liquide vaisselle|éponge|eponge|lessive|papier|nettoyant|savon|dentifrice|mouchoir|shampoing/,
		'maison'
	]
];

export const FALLBACK_AISLE_KIND = 'epicerie';

export function guessAisleKind(name: string): string {
	const normalized = String(name).toLowerCase();
	const match = RULES.find(([pattern]) => pattern.test(normalized));
	return match ? match[1] : FALLBACK_AISLE_KIND;
}
