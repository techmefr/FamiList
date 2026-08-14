export const CODE_TYPES = ['code_39', 'ean_13', 'qr_code'] as const;

export type CodeType = (typeof CODE_TYPES)[number];

/** Les formats en deux dimensions se dessinent en carré, les autres en barres. */
const MATRIX = new Set(['qr_code', 'aztec', 'data_matrix', 'pdf417']);

export const isMatrixFormat = (codeType: string) => MATRIX.has(codeType);

/**
 * Devine le format d'après la saisie, pour éviter de faire choisir l'utilisateur. Treize chiffres
 * sont un EAN-13, une suite de caractères mêlés un QR ; le reste tombe en Code 39, qui accepte
 * lettres et chiffres.
 */
export function guessCodeType(value: string): CodeType {
	const trimmed = String(value).trim();
	const digits = trimmed.replace(/\D/g, '');

	if (digits.length === 13 && digits === trimmed) return 'ean_13';
	if (/^[0-9A-Za-z\-. $/+%]+$/.test(trimmed) && trimmed.length <= 20) return 'code_39';

	return 'qr_code';
}
