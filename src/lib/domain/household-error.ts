/**
 * The database's refusals, said in the person's language.
 *
 * The household functions raise exceptions written for a log, in French without accents and never
 * translated: "code invalide ou expire", "compte non valide". Shown as they are, they all look alike — you
 * cannot tell whether the code is wrong, whether you have to leave your household first, or whether a
 * verification code is missing.
 *
 * The SQLSTATE code is not enough to tell them apart: two very different refusals share `22023`. So we read
 * the message, and fall back on a generic text for what we do not recognise — never on the raw message,
 * which means nothing to somebody who did not write the database.
 */
export type HouseholdErrorKey =
	| 'household.errorCode'
	| 'household.errorSecondFactor'
	| 'household.errorNotApproved'
	| 'household.errorLeaveFirst'
	| 'household.errorLastMember'
	| 'household.errorUnknown';

export function householdErrorKey(message: string, needsSecondFactor = false): HouseholdErrorKey {
	const said = message.toLowerCase();

	if (said.includes('code invalide') || said.includes('expire')) return 'household.errorCode';

	if (said.includes('quittez')) return 'household.errorLeaveFirst';

	if (said.includes('sans membre')) return 'household.errorLastMember';

	// "compte non valide" covers two very different situations: an account the administrator has not approved
	// yet, and a session that stopped at the password while the account requires a second factor. The second
	// has a way out, and it must be said.
	if (said.includes('compte non valide') || said.includes('foyer inconnu') || said.includes('aucun foyer')) {
		return needsSecondFactor ? 'household.errorSecondFactor' : 'household.errorNotApproved';
	}

	return 'household.errorUnknown';
}
