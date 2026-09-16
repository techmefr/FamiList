/**
 * Quand rappeler une liste datée, et laquelle mérite encore un rappel.
 *
 * Tout est pur et sans plateforme : c'est la seule partie de la fonctionnalité qui se teste, et
 * c'est aussi la seule qui décide. La couche native ne fait qu'exécuter ce qui est calculé ici.
 */

/** Une date d'événement est un jour, pas un instant : « le 14 février », pas « 14h32 ». */
const EVENT_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Le rappel tombe la veille au soir, pas le jour même.
 *
 * Le besoin est de ne pas rater les ingrédients d'une recette *avant* la date : prévenir le matin
 * du repas arrive trop tard, il faudrait encore trouver le temps d'aller au magasin. 18h la veille
 * laisse la soirée pour y passer, et c'est l'heure où l'on rentre plutôt que celle où l'on dort.
 */
export const REMINDER_HOUR = 18;
export const REMINDER_DAYS_BEFORE = 1;

export interface ReminderCandidate {
	listId: string;
	name: string;
	eventDate?: string;
	total: number;
	done: number;
}

export interface ReminderPlan {
	listId: string;
	/** Identifiant entier exigé par les notifications locales, dérivé de l'identifiant de liste. */
	id: number;
	name: string;
	eventDate: string;
	at: Date;
}

export function isEventDate(value: string | null | undefined): value is string {
	const parts = (value ?? '').match(EVENT_DATE);
	if (!parts) return false;

	const [, annee, mois, jour] = parts;
	const date = new Date(Number(annee), Number(mois) - 1, Number(jour));

	// Le constructeur accepte « 2026-02-31 » en le reportant sur mars : on le rejette en relisant.
	return (
		date.getFullYear() === Number(annee) &&
		date.getMonth() === Number(mois) - 1 &&
		date.getDate() === Number(jour)
	);
}

/**
 * L'instant du rappel, dans le fuseau de l'appareil.
 *
 * Volontairement local et non UTC : « le 14 février » est un jour vécu, et un rappel programmé en
 * UTC sonnerait à une heure qui n'a de sens nulle part. Rien n'est rendu quand l'instant est déjà
 * passé — programmer une notification dans le passé ne fait rien du tout, et l'interface doit
 * pouvoir le dire au lieu de promettre un rappel qui ne viendra pas.
 */
export function reminderAt(eventDate: string | null | undefined, now: Date): Date | null {
	if (!isEventDate(eventDate)) return null;

	const [annee, mois, jour] = eventDate.split('-').map(Number);
	const at = new Date(annee, mois - 1, jour - REMINDER_DAYS_BEFORE, REMINDER_HOUR, 0, 0, 0);

	return at.getTime() > now.getTime() ? at : null;
}

/**
 * Un entier stable pour une liste.
 *
 * Les notifications locales s'identifient par un entier 32 bits, pas par un UUID. Le rendre stable
 * est ce qui permet de reprogrammer sans doublon : la même liste retombe toujours sur le même
 * numéro, qu'on vienne de changer sa date ou de réinstaller l'application.
 */
export function reminderId(listId: string): number {
	let hash = 0;
	for (const caractere of listId) hash = (hash * 31 + caractere.charCodeAt(0)) | 0;

	// Le signe est retiré : l'implémentation Android refuse un identifiant négatif.
	return Math.abs(hash) % 2147483647;
}

/**
 * Les rappels que l'appareil doit porter, maintenant.
 *
 * Cette fonction répond d'un coup à « et si la date passe », « et si la liste est finie », « et si
 * la date change » : elle est rejouée en entier à chaque changement, et ce qu'elle ne rend plus
 * est annulé. Une liste vide garde son rappel — elle est justement celle qu'on n'a pas encore
 * remplie, et c'est le cas que l'issue décrit.
 */
export function reminderPlans(candidates: ReminderCandidate[], now: Date): ReminderPlan[] {
	const plans: ReminderPlan[] = [];

	for (const candidate of candidates) {
		const at = reminderAt(candidate.eventDate, now);
		if (!at) continue;

		// Tout est pris : le rappel n'a plus rien à rappeler.
		if (candidate.total > 0 && candidate.done === candidate.total) continue;

		plans.push({
			listId: candidate.listId,
			id: reminderId(candidate.listId),
			name: candidate.name,
			eventDate: candidate.eventDate as string,
			at
		});
	}

	return plans;
}

/**
 * Ce que l'interface a le droit d'annoncer à propos d'une date qu'on vient de saisir.
 *
 * `late` est le cas honnête et facile à oublier : la date est valide, elle est même encore devant
 * nous, mais la veille au soir est déjà passée. Aucun rappel ne partira, et il vaut mieux l'écrire
 * que laisser croire le contraire.
 */
export type ReminderStatus = 'none' | 'invalid' | 'late' | 'planned';

export function reminderStatus(
	eventDate: string | null | undefined,
	now: Date
): { status: ReminderStatus; at: Date | null } {
	if (!eventDate) return { status: 'none', at: null };
	if (!isEventDate(eventDate)) return { status: 'invalid', at: null };

	const at = reminderAt(eventDate, now);
	return at ? { status: 'planned', at } : { status: 'late', at: null };
}
