import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { t } from '$lib/i18n/index.svelte';
import { settings } from '$stores/settings.svelte';
import { pickSteps, screenSteps } from '$domain/tour';

/**
 * Présent dans le document ne suffit pas : il faut que ça se voie.
 *
 * La moitié des repères visés existent aux deux tailles d'écran et n'en montrent qu'une — l'onglet
 * Loupe est masqué sur grand écran, le bouton de filtres a une version pouce et une version
 * en-tête. `querySelector` les trouve quand même, et driver.js désignerait alors un rectangle vide
 * au coin de la page. Un élément caché n'a aucun rectangle de rendu, c'est ce qu'on lui demande.
 */
function visible(selector: string): boolean {
	const element = document.querySelector(selector);
	return element instanceof HTMLElement && element.getClientRects().length > 0;
}

/**
 * Lance le tour de l'écran courant et prévient qu'il a été montré.
 *
 * Le signal part au lancement, pas à la fermeture. La raison est dans driver.js : son crochet
 * `onDestroyed` n'est appelé que si l'élément et l'étape actifs sont tous deux encore connus au
 * moment de la fermeture, et il est purement et simplement sauté sinon. S'y fier laissait passer
 * des sorties entières, et un tour jamais marqué comme vu revient à chaque ouverture — d'une aide
 * on ferait un obstacle, exactement ce qu'on veut éviter.
 *
 * Montré vaut donc vu, abandon compris. Une personne qui l'a coupé par accident le relance par le
 * point d'interrogation, qui est là sur chaque écran.
 */
export function startTour(pathname: string, onShown: () => void) {
	const steps: DriveStep[] = pickSteps(screenSteps(pathname), visible).map((step) => ({
		element: step.selector,
		popover: {
			title: t(`tour.${step.key}Title`),
			description: t(`tour.${step.key}Body`)
		}
	}));

	// Aucune cible : la page n'est pas celle qu'on croit, ou elle n'a pas fini de se peindre. On ne
	// marque rien, la prochaine tentative repartira de zéro.
	if (steps.length === 0) return;

	driver({
		steps,
		popoverClass: 'fl-tour',
		// Le refus du mouvement est déjà respecté par le CSS ; le dire aussi ici évite que la bulle
		// se replace en glissant, ce qu'aucune règle de durée ne rattrape.
		animate: settings.animates,
		showProgress: steps.length > 1,
		allowClose: true,
		nextBtnText: t('tour.next'),
		prevBtnText: t('tour.back'),
		doneBtnText: t('tour.done'),
		progressText: t('tour.progress')
	}).drive();

	onShown();
}
