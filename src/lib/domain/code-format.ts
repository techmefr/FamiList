/**
 * The formats the card knows how to draw, and therefore the only ones we offer. Code 128 comes first: it is
 * what most retailers print.
 */
export const CODE_TYPES = [
	'code_128',
	'code_39',
	'code_93',
	'ean_13',
	'ean_8',
	'itf',
	'qr_code'
] as const;

export type CodeType = (typeof CODE_TYPES)[number];

/** Two-dimensional formats are drawn as a square, the others as bars. */
const MATRIX = new Set(['qr_code', 'aztec', 'data_matrix', 'pdf417']);

export const isMatrixFormat = (codeType: string) => MATRIX.has(codeType);

/**
 * Guesses the format from what was typed, to save the user from choosing. Thirteen digits are an EAN-13, a
 * mixed run of characters a QR; the rest falls to Code 39, which accepts letters and digits.
 */
export function guessCodeType(value: string): CodeType {
	const trimmed = String(value).trim();
	const digits = trimmed.replace(/\D/g, '');

	if (digits.length === 13 && digits === trimmed) return 'ean_13';
	if (/^[0-9A-Za-z\-. $/+%]+$/.test(trimmed) && trimmed.length <= 20) return 'code_39';

	return 'qr_code';
}
