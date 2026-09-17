/**
 * Ce qu'on retient d'un plantage avant de l'envoyer, et ce qu'on en retire.
 *
 * Une pile d'appels n'est pas une donnée technique neutre. Elle traverse des URL qui portent des
 * identifiants de foyer, des messages d'erreur où Postgres a recopié la valeur qui a violé une
 * contrainte, des chemins de fichiers qui commencent par le prénom de la personne. Le nettoyage
 * ci-dessous passe avant tout envoi.
 *
 * Ce qu'il ne peut pas faire, et il vaut mieux l'écrire que le laisser croire : le texte libre
 * d'une `Error` reste du texte libre. Si une bibliothèque écrit « impossible de supprimer
 * Pique-nique de mamie », aucune expression régulière ne distinguera ce nom d'un mot technique.
 * On coupe donc court — cinq cents caractères — et la base garde ces lignes trente jours, pas
 * davantage.
 */

const MESSAGE_LIMIT = 500;
const STACK_LIMIT = 4000;

/** D'où vient le plantage. Les mêmes quatre valeurs que la contrainte de `client_errors.source`. */
export type CrashSource = 'window' | 'promise' | 'render' | 'sync';

export interface Crash {
	fingerprint: string;
	source: CrashSource;
	message: string;
	stack: string;
	path: string;
}

/**
 * Les remplacements, dans cet ordre.
 *
 * L'ordre n'est pas décoratif : une adresse de courriel contient un point et des lettres qui
 * seraient sinon avalées par le motif des jetons longs, et une URL de données commence par des
 * caractères que le motif des UUID ne reconnaîtrait plus une fois tronqués.
 */
const REPLACEMENTS: Array<[RegExp, string]> = [
	[/\bdata:[\w/+.-]+;base64,[A-Za-z0-9+/=]+/g, '{data}'],
	[/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '{token}'],
	[/[\w.+-]+@[\w-]+\.[\w.-]+/g, '{email}'],
	[/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{id}'],
	// Un chemin absolu de développement ou d'appareil commence par le nom du compte système.
	[/\/(?:home|Users)\/[^/\s)'"]+/g, '/home/{user}'],
	// La chaîne de requête n'est retirée que si elle porte vraiment une paire clé=valeur : sinon
	// le point d'interrogation d'une phrase emporterait la fin du message.
	[/\?[\w[\]%.+-]+=[^\s)'"]*/g, '?{query}'],
	[/\b[A-Za-z0-9_-]{32,}\b/g, '{token}'],
	// Six chiffres et plus : un identifiant, un horodatage, un numéro. En dessous, ce sont les
	// numéros de ligne et de colonne de la pile, et les effacer rendrait la pile inutile.
	[/\d{6,}/g, '{n}']
];

export function scrub(text: string): string {
	return REPLACEMENTS.reduce((said, [motif, jeton]) => said.replace(motif, jeton), text);
}

/**
 * L'écran d'où vient le plantage, réduit à sa route.
 *
 * `/l/7f3a-…` devient `/l/{id}` : le segment est l'identifiant d'une liste, et le garder dirait
 * de quelle liste il s'agit sans rien apprendre sur le bug — deux personnes qui plantent sur deux
 * listes différentes plantent au même endroit du code.
 */
export function normalizePath(path: string): string {
	const withoutQuery = path.split('?')[0].split('#')[0];

	return scrub(withoutQuery.replace(/^\/l\/[^/]+/, '/l/{id}'));
}

/**
 * Le message lisible d'une cause quelconque.
 *
 * Même problème que dans la synchronisation : ce qui est levé n'est pas toujours une `Error`.
 * `describeError` répond déjà à cette question pour le bandeau, mais elle vit dans `sync/` et ne
 * connaît pas le nom de l'erreur ; ici on préfixe par le nom (`TypeError: …`), qui est ce qui
 * regroupe le mieux deux plantages identiques.
 */
function readMessage(cause: unknown): string {
	if (cause instanceof Error) {
		const body = cause.message || cause.name;
		return cause.message && cause.name ? `${cause.name}: ${cause.message}` : body;
	}

	if (typeof cause === 'string') return cause;

	if (cause && typeof cause === 'object' && 'message' in cause) {
		const message = (cause as { message: unknown }).message;
		if (typeof message === 'string' && message) return message;
	}

	return '';
}

function readStack(cause: unknown): string {
	if (cause instanceof Error && typeof cause.stack === 'string') return cause.stack;

	if (cause && typeof cause === 'object' && 'stack' in cause) {
		const stack = (cause as { stack: unknown }).stack;
		if (typeof stack === 'string') return stack;
	}

	return '';
}

/**
 * Le hachage qui sert d'empreinte : FNV-1a sur 32 bits, rendu en hexadécimal.
 *
 * Volontairement pas `crypto.subtle` : celui-ci est asynchrone, et le rapporteur doit pouvoir
 * travailler depuis un gestionnaire d'événement synchrone sans rien retarder. Il ne s'agit pas de
 * cacher quoi que ce soit — l'empreinte n'a qu'à regrouper deux plantages identiques.
 */
function hash(text: string): string {
	let value = 0x811c9dc5;

	for (let index = 0; index < text.length; index += 1) {
		value ^= text.charCodeAt(index);
		value = Math.imul(value, 0x01000193) >>> 0;
	}

	return value.toString(16).padStart(8, '0');
}

/**
 * La première image de la pile, sans numéro de ligne ni de colonne.
 *
 * Les numéros bougent à chaque build : les garder dans l'empreinte ferait apparaître le même bug
 * comme neuf à chaque déploiement, et le compteur d'occurrences ne compterait plus rien.
 */
function topFrame(stack: string): string {
	const frame = stack.split('\n').find((line) => line.includes('at ') || line.includes('@'));

	return frame ? frame.trim().replace(/:\d+:\d+/g, '') : '';
}

export function fingerprint(source: CrashSource, message: string, stack: string): string {
	const normalized = message.toLowerCase().replace(/\d+/g, '');

	return hash(`${source}|${normalized}|${topFrame(stack)}`);
}

/**
 * Tout ce qui précède, mis bout à bout.
 *
 * Renvoie `null` quand il n'y a rien à dire : une cause sans message ni pile ne remonterait qu'une
 * ligne vide dans l'écran d'administration, et une ligne vide coûte la même place qu'une utile
 * tout en n'apprenant rien.
 */
export function buildCrash(cause: unknown, source: CrashSource, path: string): Crash | null {
	const message = scrub(readMessage(cause)).trim().slice(0, MESSAGE_LIMIT);
	const stack = scrub(readStack(cause)).slice(0, STACK_LIMIT);

	if (!message) return null;

	return {
		fingerprint: fingerprint(source, message, stack),
		source,
		message,
		stack,
		path: normalizePath(path)
	};
}
