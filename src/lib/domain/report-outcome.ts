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

export type ReportOutcome = { sent: boolean; errorKey: ReportOutcomeKey | null; number: number | null };

export function readReportOutcome(payload: unknown): ReportOutcome {
	if (payload === null || typeof payload !== 'object') {
		return { sent: false, errorKey: 'bugReport.errorUnknown', number: null };
	}

	const answer = payload as { status?: unknown; number?: unknown };

	if (answer.status === 'rate_limited') {
		return { sent: false, errorKey: 'bugReport.errorTooMany', number: null };
	}

	if (answer.status === 'storage_limited') {
		return { sent: false, errorKey: 'bugReport.errorTooMuchStorage', number: null };
	}

	if (answer.status === 'submitted') {
		// Le numéro court est la seule référence que la personne pourra citer si elle nous réécrit.
		// Un envoi reste un envoi s'il manque : on ne refuse pas un signalement déposé parce que la
		// base n'a pas su nous dire son numéro.
		const number = typeof answer.number === 'number' ? answer.number : null;

		return { sent: true, errorKey: null, number };
	}

	return { sent: false, errorKey: 'bugReport.errorUnknown', number: null };
}
