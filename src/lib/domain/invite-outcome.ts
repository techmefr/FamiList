/**
 * Ce que la base répond quand on tente une invitation.
 *
 * `redeem_invite` ne lève plus d'exception sur un code refusé : une exception annulerait la
 * transaction, et avec elle le compteur de tentatives qu'on vient d'incrémenter. Elle renvoie donc
 * un objet, et c'est ici qu'on décide ce qu'il devient à l'écran.
 *
 * Trop de tentatives se dit autrement qu'un mauvais code : sans cela, la personne qui vient de se
 * tromper trois fois relit son code, le retape correctement, et l'application lui répète qu'il est
 * invalide. Elle n'a aucun moyen de comprendre qu'il faut simplement attendre.
 *
 * La forme renvoyée par un RPC n'est pas garantie côté client — une fonction mise à jour, un cache
 * de schéma en retard — donc tout ce qu'on ne reconnaît pas retombe sur le refus générique plutôt
 * que sur une adhésion qu'on n'a pas obtenue.
 */
export type InviteOutcomeKey =
	| 'household.errorCode'
	| 'household.errorTooManyAttempts'
	| 'household.errorUnknown';

export type InviteOutcome = { householdId: string | null; errorKey: InviteOutcomeKey | null };

export function readInviteOutcome(payload: unknown): InviteOutcome {
	if (payload === null || typeof payload !== 'object') {
		return { householdId: null, errorKey: 'household.errorUnknown' };
	}

	const answer = payload as { status?: unknown; household_id?: unknown };

	if (answer.status === 'rate_limited') {
		return { householdId: null, errorKey: 'household.errorTooManyAttempts' };
	}

	if (answer.status === 'invalid') {
		return { householdId: null, errorKey: 'household.errorCode' };
	}

	if (answer.status === 'joined' && typeof answer.household_id === 'string') {
		return { householdId: answer.household_id, errorKey: null };
	}

	return { householdId: null, errorKey: 'household.errorUnknown' };
}
