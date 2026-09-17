/**
 * The codes people copy by hand: the one received by email, and the backup ones.
 *
 * They almost always arrive damaged — pasted from a mail client with a non-breaking space at the end,
 * dictated over the phone with dashes, copied from paper in lower case. None of that is the fault of the
 * person typing, and refusing input over a space would be the kind of strictness that protects nothing.
 */

/** An email code is six digits. Supabase decides that, not us. */
export const OTP_LENGTH = 6;

/** A backup code is ten characters, drawn from an alphabet with no ambiguous letter. */
export const BACKUP_LENGTH = 10;

/**
 * The alphabet of the backup codes, the same as the database function's.
 *
 * No O, no I, no L, no U: they would be read as 0, 1, 1 and V. Those are the four confusions that make a
 * code copied from paper fail, without being able to say which one occurred.
 */
export const BACKUP_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Keeps only the digits, and no more than six. */
export function normalizeOtp(input: string): string {
	return input.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

export function isCompleteOtp(input: string): boolean {
	return normalizeOtp(input).length === OTP_LENGTH;
}

/**
 * Puts a backup code into the shape the database expects: upper case, no separator.
 *
 * Characters outside the alphabet are dropped rather than refused. A zero typed in place of an O does not
 * exist in this alphabet — but there is no O either, so there is nothing to correct: we simply drop what
 * the database would not recognise.
 */
export function normalizeBackupCode(input: string): string {
	return [...input.toUpperCase()]
		.filter((character) => BACKUP_ALPHABET.includes(character))
		.join('')
		.slice(0, BACKUP_LENGTH);
}

export function isCompleteBackupCode(input: string): boolean {
	return normalizeBackupCode(input).length === BACKUP_LENGTH;
}

/** Split in two for reading: ten characters in a row are copied badly. */
export function formatBackupCode(code: string): string {
	const clean = normalizeBackupCode(code);
	if (clean.length !== BACKUP_LENGTH) return clean;

	return `${clean.slice(0, 5)}-${clean.slice(5)}`;
}

/**
 * The contents of the file downloaded at the same time the codes are shown.
 *
 * A screen of ten codes closes with one gesture and never comes back: it is the most fragile moment of the
 * whole 2FA. The file is not a luxury, it is what stops you losing your account.
 */
export function backupCodesText(codes: string[], heading: string): string {
	return [heading, '', ...codes.map(formatBackupCode), ''].join('\n');
}
