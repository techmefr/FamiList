/**
 * Ce que la base répond quand on dépose un signalement.
 *
 * `submit_bug_report` plafonne désormais à vingt signalements et douze mégaoctets de captures par
 * compte sur vingt-quatre heures glissantes. Elle ne lève pas pour autant : une exception
 * remonterait au formulaire sous la forme d'un message Postgres en anglais, que personne ne peut
 * traduire. Elle renvoie un objet, et c'est ici qu'on décide ce qu'il devient à l'écran.
 *
 * Les deux plafonds se disent séparément parce qu'ils n'appellent pas le même geste : trop de
 * signalements, il faut attendre ; trop de captures, le texte seul passe encore et c'est utile de
 * le savoir avant de renoncer.
 *
 * La forme renvoyée par un RPC n'est pas garantie côté client — une fonction mise à jour, un cache
 * de schéma en retard — donc tout ce qu'on ne reconnaît pas retombe sur l'échec générique plutôt
 * que sur un envoi qu'on n'a pas obtenu.
 */
export type ReportOutcomeKey =
	| 'bugReport.errorTooMany'
	| 'bugReport.errorTooMuchStorage'
	| 'bugReport.errorUnknown';

export type ReportOutcome = { sent: boolean; errorKey: ReportOutcomeKey | null };

export function readReportOutcome(payload: unknown): ReportOutcome {
	if (payload === null || typeof payload !== 'object') {
		return { sent: false, errorKey: 'bugReport.errorUnknown' };
	}

	const answer = payload as { status?: unknown };

	if (answer.status === 'rate_limited') {
		return { sent: false, errorKey: 'bugReport.errorTooMany' };
	}

	if (answer.status === 'storage_limited') {
		return { sent: false, errorKey: 'bugReport.errorTooMuchStorage' };
	}

	if (answer.status === 'submitted') {
		return { sent: true, errorKey: null };
	}

	return { sent: false, errorKey: 'bugReport.errorUnknown' };
}
