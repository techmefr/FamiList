/**
 * Taking your data with you, then closing your account.
 *
 * The confirming gesture is typing your own email address. A checkbox gets ticked without reading, and a
 * word to copy would have to be translated into ten languages — and therefore read in the right one. The
 * address belongs to the person alone, cannot be guessed from somebody else's screen, and typing it again
 * takes the time it takes to change your mind.
 */
export type DeleteAccountErrorKey =
	| 'security.deleteErrorLastAdmin'
	| 'security.deleteErrorDemo'
	| 'security.deleteErrorSecondFactor'
	| 'security.deleteErrorUnknown';

/**
 * The comparison ignores case and surrounding spaces: an email address is not case sensitive, and a phone
 * keyboard happily adds a capital or a trailing space. This is not a secret to guess, it is a confirmation
 * to write — hardening it would protect nothing and would block the person at the moment they most need it
 * to work.
 */
export function matchesConfirmation(typed: string, email: string | null): boolean {
	const target = (email ?? '').trim().toLowerCase();

	return target !== '' && typed.trim().toLowerCase() === target;
}

export function deleteAccountErrorKey(message: string): DeleteAccountErrorKey {
	const said = message.toLowerCase();

	if (said.includes('administrateur')) return 'security.deleteErrorLastAdmin';

	if (said.includes('demonstration')) return 'security.deleteErrorDemo';

	if (said.includes('deuxieme facteur')) return 'security.deleteErrorSecondFactor';

	return 'security.deleteErrorUnknown';
}

/** A file name that still makes sense in a downloads folder six months later. */
export function exportFileName(at: Date): string {
	const day = [
		at.getFullYear(),
		String(at.getMonth() + 1).padStart(2, '0'),
		String(at.getDate()).padStart(2, '0')
	].join('-');

	return `familiste-mes-donnees-${day}.json`;
}
