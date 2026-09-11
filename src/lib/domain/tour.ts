/**
 * Le contenu de la visite guidée : quel écran raconte quoi, et dans quel ordre.
 *
 * Rien ici ne touche au document. La partie qui dépend du navigateur — savoir si un repère est
 * réellement visible, et piloter driver.js — vit dans `$lib/tour`, et ne descend qu'à la demande.
 * Séparer les deux permet de vérifier le choix des étapes sans navigateur, là où un rendu de test
 * ne saurait de toute façon pas dire ce qui est visible.
 */
export interface TourStep {
	/** Le repère visé. Toujours un `data-test-id` déjà posé : un sélecteur inventé pour le tour
	 * disparaît au premier remaniement, et personne ne s'en aperçoit. */
	selector: string;
	/** La racine des deux clés de traduction, `tour.<key>Title` et `tour.<key>Body`. */
	key: string;
}

/**
 * Le tour d'ensemble : ce que porte la barre de navigation. C'est celui de la première ouverture,
 * et celui vers lequel on retombe sur un écran qui n'a rien de particulier à expliquer.
 */
export const NAV_STEPS: TourStep[] = [
	{ selector: '[data-test-id="nav-create"]', key: 'create' },
	{ selector: '[data-test-id="nav-/magnifier"]', key: 'magnifier' },
	{ selector: '[data-test-id="nav-/chat"]', key: 'chat' },
	{ selector: '[data-test-id="nav-/shops"]', key: 'shops' },
	{ selector: '[data-test-id="nav-/cards"]', key: 'cards' },
	// Le profil est dans la colonne sur grand écran et dans l'en-tête sur téléphone. Deux repères,
	// une seule étape : `pickSteps` garde celui qui se voit et laisse tomber l'autre.
	{ selector: '[data-test-id="nav-/profile"]', key: 'profile' },
	{ selector: '[data-test-id="header-profile"]', key: 'profile' }
];

/**
 * Ce que le point d'interrogation raconte selon l'écran ouvert.
 *
 * Une aide qui répète toujours la même chose n'est lue qu'une fois. Quelqu'un qui l'appelle depuis
 * une liste de courses ne se demande pas où sont ses cartes de fidélité : il se demande à quoi
 * sert la poignée à gauche d'un rayon, ou pourquoi la moitié de sa liste a disparu.
 *
 * Deux repères peuvent porter la même clé — les filtres se prennent par la barre du pouce sur
 * téléphone et par le bouton d'en-tête sur grand écran. Celui des deux qui se voit gagne.
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
 * Les étapes candidates pour ce chemin.
 *
 * Un écran inconnu — le foyer, l'administration, une page ajoutée demain — retombe sur la barre de
 * navigation : mieux vaut redire où sont les choses que de ne rien répondre à quelqu'un qui
 * demande de l'aide.
 */
export function screenSteps(pathname: string): TourStep[] {
	return SCREEN_STEPS.find((entry) => entry.test.test(pathname))?.steps ?? NAV_STEPS;
}

/** Les étapes retenues : celles qui se voient, une seule par sujet, dans l'ordre d'origine. */
export function pickSteps(steps: TourStep[], isVisible: (selector: string) => boolean): TourStep[] {
	const seen = new Set<string>();

	return steps.filter((step) => {
		if (seen.has(step.key) || !isVisible(step.selector)) return false;

		seen.add(step.key);
		return true;
	});
}
