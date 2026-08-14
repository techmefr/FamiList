/**
 * Heuristique volontairement simple, reprise du prototype (flGuessAisle). Elle propose un rayon à
 * l'ajout d'un article, l'utilisateur peut toujours le changer. Pas d'appel réseau, pas de modèle :
 * une erreur de devinette coûte un clic, une latence coûte l'usage.
 */
const RULES: [RegExp, string][] = [
	[
		/tomate|salade|pomme|carotte|poireau|raisin|fruit|légume|legume|citron|oignon|herbe|persil|basilic|champignon|banane|courgette|concombre|pomme de terre/,
		'fruits'
	],
	[/pain|baguette|croissant|brioche|tarte|pâte feuillet|pate feuillet|viennoiser/, 'boulangerie'],
	[
		// « œuf » doit être un début de mot, sinon « bœuf » tombe dans les produits laitiers.
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

export const FALLBACK_AISLE = 'epicerie';

export function guessAisle(name: string): string {
	const normalized = String(name).toLowerCase();
	const match = RULES.find(([pattern]) => pattern.test(normalized));
	return match ? match[1] : FALLBACK_AISLE;
}
