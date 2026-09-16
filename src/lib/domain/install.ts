/**
 * Quand proposer d'installer l'application, et à qui.
 *
 * Rien ici ne touche au navigateur : la capture de `beforeinstallprompt`, la détection du mode
 * autonome et le stockage vivent dans `$stores/install`. Ce qui se décide ici — est-ce le bon
 * moment, le refus est-il encore valable, quel chemin d'installation existe sur cet appareil — se
 * vérifie sans navigateur, et c'est précisément la partie qu'on ne veut pas voir dériver.
 */

/**
 * Le nombre d'ouvertures avant de proposer quoi que ce soit.
 *
 * À la première visite, personne ne sait encore si l'application lui plaît ; lui demander de la
 * poser sur son écran d'accueil revient à demander un engagement avant le premier service rendu.
 * Trois ouvertures, ce n'est pas une mesure d'enthousiasme, mais c'est déjà quelqu'un qui est
 * revenu de lui-même — deux fois.
 */
export const MIN_OPENINGS = 3;

/**
 * La durée pendant laquelle un refus est tenu pour acquis : six mois.
 *
 * Une invite qui revient à chaque visite est une nuisance, et une nuisance finit par faire fermer
 * l'onglet plutôt qu'installer l'application. Six mois laissent la place à un vrai changement
 * d'avis — une nouvelle saison d'usage, un nouveau téléphone — sans jamais ressembler à du
 * harcèlement.
 */
export const REFUSAL_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * Par où passe l'installation sur cet appareil.
 *
 * `prompt` : le navigateur a proposé `beforeinstallprompt`, on peut ouvrir l'invite système.
 * `ios` : rien à déclencher, le geste appartient à Safari — on l'explique avec des mots.
 * `none` : aucun chemin honnête, on se tait plutôt que de promettre un bouton qui ne fera rien.
 */
export type InstallRoute = 'prompt' | 'ios' | 'none';

export interface InstallContext {
	/** La coquille Capacitor : l'application est déjà installée, il n'y a rien à proposer. */
	isNative: boolean;
	/** Déjà lancée depuis l'écran d'accueil — `display-mode: standalone`. */
	isInstalled: boolean;
	route: InstallRoute;
	openings: number;
	/** Date du dernier refus, en millisecondes, ou `null` si on n'a jamais rien demandé. */
	refusedAt: number | null;
	now: number;
}

/**
 * iOS n'émet jamais `beforeinstallprompt`, et ne le fera pas : sur iPhone et iPad, l'ajout à
 * l'écran d'accueil est un geste de Safari, pas une API.
 *
 * Depuis iPadOS 13, un iPad se présente comme un Macintosh ; le nombre de points de contact est le
 * seul moyen restant de le distinguer d'un vrai Mac, où le menu Partager ne propose pas ce geste.
 *
 * Les navigateurs tiers sur iOS sont écartés : ils empruntent bien WebKit, mais leur menu de
 * partage ne porte pas « Sur l'écran d'accueil ». Leur donner la marche à suivre de Safari serait
 * les envoyer chercher un bouton qui n'existe pas.
 */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
	const isApple = /iPhone|iPod|iPad/.test(userAgent);
	const isIpadOnDesktopUa = /Macintosh/.test(userAgent) && maxTouchPoints > 1;
	if (!isApple && !isIpadOnDesktopUa) return false;

	// Chrome, Firefox, Edge et Opera sur iOS, reconnaissables à leur suffixe.
	return !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//.test(userAgent);
}

export function installRoute(hasPrompt: boolean, isIos: boolean): InstallRoute {
	if (hasPrompt) return 'prompt';
	if (isIos) return 'ios';
	return 'none';
}

/** Un refus périmé redevient une question qu'on a le droit de poser. */
export function isRefusalExpired(refusedAt: number | null, now: number): boolean {
	if (refusedAt === null) return true;

	// Une horloge remise en arrière rendrait la date de refus éternellement « dans le futur » :
	// on la traite alors comme un refus tout frais plutôt que comme un refus périmé.
	if (refusedAt > now) return false;

	return now - refusedAt >= REFUSAL_MS;
}

export function shouldOffer(context: InstallContext): boolean {
	if (context.isNative || context.isInstalled) return false;
	if (context.route === 'none') return false;
	if (context.openings < MIN_OPENINGS) return false;

	return isRefusalExpired(context.refusedAt, context.now);
}

/**
 * L'explication reste accessible depuis le menu d'aide même quand le bandeau se tait : quelqu'un
 * qui a dit « plus tard » il y a un mois doit pouvoir revenir de lui-même, sans attendre six mois.
 * Seul le cas « aucun chemin » disparaît vraiment — et l'application déjà installée, qui n'a plus
 * rien à apprendre là-dessus.
 */
export function canExplain(context: Pick<InstallContext, 'isNative' | 'isInstalled' | 'route'>) {
	return !context.isNative && !context.isInstalled && context.route !== 'none';
}
