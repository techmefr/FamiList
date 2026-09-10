/**
 * Le code à six chiffres d'un authentificateur, calculé depuis le secret.
 *
 * L'application n'en a pas besoin pour fonctionner — c'est Supabase qui vérifie les codes, et
 * c'est l'authentificateur de l'utilisateur qui les produit. Cette implémentation existe pour les
 * tests : sans elle, la deuxième étape ne pouvait être vérifiée qu'à la main, avec un téléphone,
 * ce qui revient à ne jamais la vérifier.
 *
 * RFC 6238, dans le réglage que Supabase utilise : SHA-1, six chiffres, fenêtre de trente
 * secondes.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Décode le secret tel qu'il est affiché à l'écran : base32, sans remplissage, casse libre. */
export function base32Decode(secret: string): Uint8Array {
	const propre = secret.replace(/[\s=-]/g, '').toUpperCase();
	const octets: number[] = [];
	let tampon = 0;
	let bits = 0;

	for (const lettre of propre) {
		const valeur = ALPHABET.indexOf(lettre);
		if (valeur === -1) throw new Error(`caractere hors base32 : ${lettre}`);

		tampon = (tampon << 5) | valeur;
		bits += 5;

		if (bits >= 8) {
			bits -= 8;
			octets.push((tampon >> bits) & 0xff);
		}
	}

	return Uint8Array.from(octets);
}

/** Le compteur de la RFC : le nombre de fenêtres de trente secondes écoulées depuis l'époque. */
export function totpCounter(atMs: number, stepSeconds = 30): bigint {
	return BigInt(Math.floor(atMs / 1000 / stepSeconds));
}

/** Le compteur, écrit sur huit octets en gros-boutien, tel qu'il entre dans le HMAC. */
export function counterBytes(counter: bigint): Uint8Array {
	const octets = new Uint8Array(8);
	let reste = counter;

	for (let i = 7; i >= 0; i--) {
		octets[i] = Number(reste & 0xffn);
		reste >>= 8n;
	}

	return octets;
}

/**
 * La troncature dynamique de la RFC : quatre octets choisis par les quatre derniers bits du
 * condensat, puis les six derniers chiffres décimaux.
 */
export function truncate(digest: Uint8Array, digits = 6): string {
	const decalage = digest[digest.length - 1] & 0x0f;
	const binaire =
		((digest[decalage] & 0x7f) << 24) |
		((digest[decalage + 1] & 0xff) << 16) |
		((digest[decalage + 2] & 0xff) << 8) |
		(digest[decalage + 3] & 0xff);

	return String(binaire % 10 ** digits).padStart(digits, '0');
}
