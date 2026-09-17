/**
 * What the database answers when an invitation is attempted.
 *
 * `redeem_invite` no longer raises an exception on a refused code: an exception would roll the transaction
 * back, and with it the attempt counter just incremented. So it returns an object, and this is where we
 * decide what that becomes on screen.
 *
 * Too many attempts is said differently from a wrong code: without that, the person who has just got it
 * wrong three times reads their code again, types it correctly, and the application repeats that it is
 * invalid. They have no way of understanding that they simply have to wait.
 *
 * The shape returned by an RPC is not guaranteed on the client side — an updated function, a schema cache
 * lagging behind — so anything we do not recognise falls back on the generic refusal rather than on a
 * joining we did not obtain.
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
