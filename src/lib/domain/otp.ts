/**
 * Les codes qu'on recopie à la main : celui reçu par courriel, et ceux de secours.
 *
 * Ils arrivent presque toujours abîmés — collés depuis un client de messagerie avec une espace
 * insécable au bout, dictés au téléphone avec des tirets, recopiés d'un papier en minuscules. Rien
 * de tout cela n'est une faute de la personne qui saisit, et refuser la saisie pour un espace
 * serait le genre de rigueur qui ne protège de rien.
 */

/** Un code de courriel fait six chiffres. C'est Supabase qui le décide, pas nous. */
export const OTP_LENGTH = 6;

/** Un code de secours fait dix caractères, pris dans un alphabet sans lettre ambiguë. */
export const BACKUP_LENGTH = 10;

/**
 * L'alphabet des codes de secours, le même que celui de la fonction en base.
 *
 * Ni O, ni I, ni L, ni U : on les lirait 0, 1, 1 et V. Ce sont les quatre confusions qui font
 * qu'un code recopié d'un papier ne passe pas, sans qu'on puisse dire laquelle a eu lieu.
 */
export const BACKUP_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Ne garde que les chiffres, et pas plus de six. */
export function normalizeOtp(input: string): string {
	return input.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

export function isCompleteOtp(input: string): boolean {
	return normalizeOtp(input).length === OTP_LENGTH;
}

/**
 * Met un code de secours dans la forme attendue par la base : majuscules, sans séparateur.
 *
 * Les caractères hors alphabet sont écartés plutôt que refusés. Un zéro tapé à la place d'un O
 * n'existe pas dans cet alphabet — mais il n'y a pas non plus de O, donc rien à corriger : on
 * laisse simplement tomber ce que la base ne saurait pas reconnaître.
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

/** Coupé en deux pour la lecture : dix caractères d'affilée se recopient mal. */
export function formatBackupCode(code: string): string {
	const propre = normalizeBackupCode(code);
	if (propre.length !== BACKUP_LENGTH) return propre;

	return `${propre.slice(0, 5)}-${propre.slice(5)}`;
}

/**
 * Le contenu du fichier qu'on télécharge en même temps qu'on affiche les codes.
 *
 * Un écran de dix codes se ferme d'un geste et ne revient jamais : c'est le moment le plus fragile
 * de toute la 2FA. Le fichier n'est pas un luxe, c'est ce qui évite de perdre son compte.
 */
export function backupCodesText(codes: string[], heading: string): string {
	return [heading, '', ...codes.map(formatBackupCode), ''].join('\n');
}
