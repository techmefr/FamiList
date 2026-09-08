import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { t } from '$lib/i18n/index.svelte';
import { settings } from '$stores/settings.svelte';

/**
 * Les étapes visent les repères déjà posés pour les tests : rien à ajouter dans les gabarits, et
 * un sélecteur qui disparaît casse un test avant de casser le tour.
 *
 * L'ordre suit la barre de navigation. La loupe n'existe pas sur grand écran — elle se sert de
 * l'appareil photo arrière — d'où le filtre sur la présence réelle de l'élément plutôt qu'une
 * liste figée : driver.js s'arrête net sur une cible absente.
 */
const STEPS = [
	{ selector: '[data-test-id="nav-create"]', key: 'create' },
	{ selector: '[data-test-id="nav-/magnifier"]', key: 'magnifier' },
	{ selector: '[data-test-id="nav-/shops"]', key: 'shops' },
	{ selector: '[data-test-id="nav-/cards"]', key: 'cards' },
	{ selector: '[data-test-id="nav-/profile"]', key: 'profile' }
];

/**
 * Lance le tour et prévient qu'il a été montré.
 *
 * Le signal part au lancement, pas à la fermeture. La raison est dans driver.js : son crochet
 * `onDestroyed` n'est appelé que si l'élément et l'étape actifs sont tous deux encore connus au
 * moment de la fermeture, et il est purement et simplement sauté sinon. S'y fier laissait passer
 * des sorties entières, et un tour jamais marqué comme vu revient à chaque ouverture — d'une aide
 * on ferait un obstacle, exactement ce qu'on veut éviter.
 *
 * Montré vaut donc vu, abandon compris. Une personne qui l'a coupé par accident le relance depuis
 * son profil, ce qui est de toute façon le chemin qu'il lui faut connaître.
 */
export function startTour(onShown: () => void) {
	const steps: DriveStep[] = STEPS.filter(
		(step) => document.querySelector(step.selector) !== null
	).map((step) => ({
		element: step.selector,
		popover: {
			title: t(`tour.${step.key}Title`),
			description: t(`tour.${step.key}Body`)
		}
	}));

	// Aucune cible : la page n'est pas celle qu'on croit. On ne marque rien, la prochaine visite
	// de l'accueil réessaiera.
	if (steps.length === 0) return;

	driver({
		steps,
		popoverClass: 'fl-tour',
		// Le refus du mouvement est déjà respecté par le CSS ; le dire aussi ici évite que la bulle
		// se replace en glissant, ce qu'aucune règle de durée ne rattrape.
		animate: settings.animates,
		showProgress: true,
		allowClose: true,
		nextBtnText: t('tour.next'),
		prevBtnText: t('tour.back'),
		doneBtnText: t('tour.done'),
		progressText: t('tour.progress')
	}).drive();

	onShown();
}
