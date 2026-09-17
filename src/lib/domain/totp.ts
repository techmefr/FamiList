/**
 * The six-digit code of an authenticator, computed from the secret.
 *
 * The application does not need it to work — Supabase is what checks the codes, and the user's
 * authenticator is what produces them. This implementation exists for the tests: without it, the second
 * step could only be checked by hand, with a phone, which amounts to never checking it.
 *
 * RFC 6238, in the setting Supabase uses: SHA-1, six digits, thirty-second window.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Decodes the secret as it is shown on screen: base32, no padding, any case. */
export function base32Decode(secret: string): Uint8Array {
	const clean = secret.replace(/[\s=-]/g, '').toUpperCase();
	const bytes: number[] = [];
	let buffer = 0;
	let bits = 0;

	for (const letter of clean) {
		const value = ALPHABET.indexOf(letter);
		if (value === -1) throw new Error(`caractere hors base32 : ${letter}`);

		buffer = (buffer << 5) | value;
		bits += 5;

		if (bits >= 8) {
			bits -= 8;
			bytes.push((buffer >> bits) & 0xff);
		}
	}

	return Uint8Array.from(bytes);
}

/** The RFC counter: the number of thirty-second windows elapsed since the epoch. */
export function totpCounter(atMs: number, stepSeconds = 30): bigint {
	return BigInt(Math.floor(atMs / 1000 / stepSeconds));
}

/** The counter, written on eight bytes big-endian, as it goes into the HMAC. */
export function counterBytes(counter: bigint): Uint8Array {
	const bytes = new Uint8Array(8);
	let rest = counter;

	for (let i = 7; i >= 0; i--) {
		bytes[i] = Number(rest & 0xffn);
		rest >>= 8n;
	}

	return bytes;
}

/**
 * The RFC's dynamic truncation: four bytes chosen by the last four bits of the digest, then the last six
 * decimal digits.
 */
export function truncate(digest: Uint8Array, digits = 6): string {
	const shift = digest[digest.length - 1] & 0x0f;
	const binary =
		((digest[shift] & 0x7f) << 24) |
		((digest[shift + 1] & 0xff) << 16) |
		((digest[shift + 2] & 0xff) << 8) |
		(digest[shift + 3] & 0xff);

	return String(binary % 10 ** digits).padStart(digits, '0');
}
