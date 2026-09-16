import { browser } from '$app/environment';
import { Capacitor } from '@capacitor/core';
import { canExplain, installRoute, isIosSafari, shouldOffer } from '$domain/install';

/**
 * L'invite d'installation de Chrome et Edge. Elle n'est pas dans la bibliothèque de types : la
 * spécification n'est portée que par ces navigateurs.
 */
interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Le compteur d'ouvertures et la date du refus, sur l'appareil.
 *
 * `localStorage` et non `@capacitor/preferences`, alors que les deux existent dans le projet : la
 * question ne se pose que sur le web, où Preferences n'est de toute façon qu'une enveloppe
 * asynchrone autour de `localStorage`. La lecture sert au premier rendu, et un aller-retour
 * asynchrone ferait apparaître le bandeau après coup, sous le doigt de quelqu'un qui visait autre
 * chose. Ces deux valeurs appartiennent en plus au navigateur lui-même — installer Familiste dans
 * Chrome ne dit rien de Firefox — donc ni la base ni les préférences synchronisées.
 */
const STORAGE_KEY = 'familist:install';

interface Stored {
	openings: number;
	refusedAt: number | null;
}

function read(): Stored {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');

		return {
			openings: typeof saved.openings === 'number' ? saved.openings : 0,
			refusedAt: typeof saved.refusedAt === 'number' ? saved.refusedAt : null
		};
	} catch {
		return { openings: 0, refusedAt: null };
	}
}

class InstallStore {
	#prompt = $state<BeforeInstallPromptEvent | null>(null);
	#openings = $state(0);
	#refusedAt = $state<number | null>(null);
	#isNative = $state(false);
	#isIos = $state(false);
	#isInstalled = $state(false);
	#ready = $state(false);

	/**
	 * L'heure figée au démarrage. Un `Date.now()` lu dans un `$derived` ne serait pas réactif, et
	 * surtout : personne n'a besoin de voir le bandeau réapparaître à la seconde où un refus expire,
	 * au milieu d'une session.
	 */
	#startedAt = Date.now();

	/** Le bandeau, rangé pour cette session sans que ce soit encore un refus. */
	dismissed = $state(false);

	/** L'explication, ouverte depuis le bandeau ou depuis le menu d'aide. */
	detailsOpen = $state(false);

	route = $derived(installRoute(this.#prompt !== null, this.#isIos));

	/** Vrai quand le geste d'installation appartient à Safari et se raconte avec des mots. */
	isManual = $derived(this.route === 'ios');

	canExplain = $derived(
		this.#ready &&
			canExplain({
				isNative: this.#isNative,
				isInstalled: this.#isInstalled,
				route: this.route
			})
	);

	offers = $derived(
		this.#ready &&
			!this.dismissed &&
			shouldOffer({
				isNative: this.#isNative,
				isInstalled: this.#isInstalled,
				route: this.route,
				openings: this.#openings,
				refusedAt: this.#refusedAt,
				now: this.#startedAt
			})
	);

	/**
	 * Une ouverture de plus au compteur, et l'écoute de l'invite du navigateur.
	 *
	 * `beforeinstallprompt` ne passe qu'une fois : sans capture, l'invite est perdue pour la
	 * session entière et le bouton n'aurait plus rien à déclencher. D'où l'écoute posée au
	 * démarrage, bien avant que le bandeau ait le droit de s'afficher.
	 */
	init() {
		if (!browser || this.#ready) return;

		this.#isNative = Capacitor.isNativePlatform();
		if (this.#isNative) {
			this.#ready = true;
			return;
		}

		const stored = read();
		this.#openings = stored.openings + 1;
		this.#refusedAt = stored.refusedAt;
		this.#save();

		this.#isIos = isIosSafari(navigator.userAgent, navigator.maxTouchPoints);
		this.#isInstalled = this.#detectInstalled();

		window.addEventListener('beforeinstallprompt', (event) => {
			// Sans ça, Chrome affiche sa propre barre d'installation : deux propositions pour la
			// même chose, dont une qui ne sait rien de ce que l'application apporte.
			event.preventDefault();
			this.#prompt = event as BeforeInstallPromptEvent;
		});

		// L'installation peut aussi venir d'ailleurs — le menu du navigateur. Le bandeau doit
		// disparaître sans attendre un rechargement.
		window.addEventListener('appinstalled', () => {
			this.#prompt = null;
			this.#isInstalled = true;
		});

		this.#ready = true;
	}

	#detectInstalled(): boolean {
		// `navigator.standalone` est propre à iOS et absent des types du DOM.
		const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;

		return matchMedia('(display-mode: standalone)').matches || iosStandalone;
	}

	#save() {
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({ openings: this.#openings, refusedAt: this.#refusedAt })
			);
		} catch {
			// Stockage refusé — navigation privée, quota plein. La proposition reviendra à la
			// prochaine ouverture : gênant, jamais bloquant.
		}
	}

	/**
	 * Ouvre l'invite du navigateur.
	 *
	 * L'événement ne se rejoue pas : accepté ou refusé, il est consommé, et on l'oublie. Un refus
	 * pris là est un vrai refus — il vaut celui du bandeau, sinon la même question reviendrait à
	 * l'ouverture suivante.
	 */
	async accept() {
		const prompt = this.#prompt;
		if (!prompt) return;

		this.#prompt = null;

		try {
			await prompt.prompt();
			const { outcome } = await prompt.userChoice;
			if (outcome === 'dismissed') this.refuse();
			else this.dismissed = true;
		} catch {
			// Invite déjà consommée par un autre onglet : rien à signaler, le menu du navigateur
			// reste ouvert à qui veut.
			this.dismissed = true;
		}
	}

	/** « Plus tard », et on s'en souvient six mois. */
	refuse() {
		this.dismissed = true;
		this.detailsOpen = false;
		this.#refusedAt = Date.now();
		this.#save();
	}

	showDetails() {
		this.detailsOpen = true;
	}

	hideDetails() {
		this.detailsOpen = false;
	}
}

export const install = new InstallStore();
