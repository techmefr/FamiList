/**
 * The refusals of administration writes, said in the person's language.
 *
 * Two of them look alike and call for entirely different gestures: "reserve aux administrateurs" means the
 * role has been taken away, and there is nothing to be done; "elevation requise" means the role is still
 * there but the session stopped at the password, and there you simply have to finish signing in. Shown raw,
 * both read as a closed door.
 *
 * The rest is left as it is — `null`. The panel's other refusals are precise and useful ("le compte doit
 * etre valide avant d etre promu", "il doit rester au moins un administrateur"): replacing them with a
 * generic text would lose more than it would translate.
 */
export type AdminErrorKey = 'admin.errorDenied' | 'admin.errorSecondFactor';

export function adminErrorKey(message: string): AdminErrorKey | null {
	const said = message.toLowerCase();

	if (said.includes('elevation requise')) return 'admin.errorSecondFactor';

	if (said.includes('reserve aux administrateurs')) return 'admin.errorDenied';

	return null;
}

/** The only one of the two causes with a way out: say it on screen rather than deduce it again. */
export function needsElevation(messages: string[]): boolean {
	return messages.some((message) => adminErrorKey(message) === 'admin.errorSecondFactor');
}
