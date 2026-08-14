/**
 * Génération de codes-barres linéaires. Rien n'est décoratif ici : la carte affichée à la caisse
 * doit scanner comme la carte en plastique, sinon la fonctionnalité ne sert à rien.
 *
 * Une barre est décrite par sa largeur en modules et sa couleur. Le rendu SVG se contente
 * d'empiler ces largeurs, ce qui garde le tracé net quelle que soit la taille d'écran.
 */
export interface CodeElement {
	width: number;
	dark: boolean;
}

/** Code 39 : 9 éléments par caractère, alternance barre/espace, 1 = large. */
const CODE_39: Record<string, string> = {
	'0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000', '4': '000110001',
	'5': '100110000', '6': '001110000', '7': '000100101', '8': '100100100', '9': '001100100',
	A: '100001001', B: '001001001', C: '101001000', D: '000011001', E: '100011000',
	F: '001011000', G: '000001101', H: '100001100', I: '001001100', J: '000011100',
	K: '100000011', L: '001000011', M: '101000010', N: '000010011', O: '100010010',
	P: '001010010', Q: '000000111', R: '100000110', S: '001000110', T: '000010110',
	U: '110000001', V: '011000001', W: '111000000', X: '010010001', Y: '110010000',
	Z: '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', $: '010101000',
	'/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
};

const NARROW = 1;
const WIDE = 3;

export function code39(value: string): CodeElement[] {
	const clean = String(value)
		.toUpperCase()
		.replace(/[^0-9A-Z\-. $/+%]/g, '');

	// Les astérisques encadrent la donnée : c'est le caractère de départ et d'arrêt de la norme,
	// un lecteur refuse un code qui n'en a pas.
	const chars = ['*', ...clean.split(''), '*'];
	const out: CodeElement[] = [];

	chars.forEach((char, index) => {
		const pattern = CODE_39[char] ?? CODE_39['0'];

		for (let i = 0; i < 9; i++) {
			out.push({ width: pattern[i] === '1' ? WIDE : NARROW, dark: i % 2 === 0 });
		}

		if (index < chars.length - 1) out.push({ width: NARROW, dark: false });
	});

	return out;
}

/**
 * EAN-13. Les six chiffres de gauche alternent entre deux jeux (L et G) selon un motif dicté par
 * le premier chiffre, qui n'est lui-même jamais dessiné — c'est cette alternance qui le code.
 */
const EAN_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const EAN_G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const EAN_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const EAN_PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

/** Clé de contrôle EAN-13 : somme pondérée 1/3 des douze premiers chiffres. */
export function ean13CheckDigit(twelve: string): number {
	const sum = twelve
		.slice(0, 12)
		.split('')
		.reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);

	return (10 - (sum % 10)) % 10;
}

/** Renvoie le code à 13 chiffres, ou null si la saisie ne peut pas en former un. */
export function normalizeEan13(value: string): string | null {
	const digits = String(value).replace(/\D/g, '');

	if (digits.length === 12) return digits + ean13CheckDigit(digits);
	if (digits.length === 13 && Number(digits[12]) === ean13CheckDigit(digits)) return digits;

	return null;
}

export function ean13(value: string): CodeElement[] | null {
	const digits = normalizeEan13(value);
	if (!digits) return null;

	const out: CodeElement[] = [];
	const emit = (pattern: string) => {
		for (const bit of pattern) out.push({ width: 1, dark: bit === '1' });
	};

	emit('101');

	const parity = EAN_PARITY[Number(digits[0])];
	for (let i = 1; i <= 6; i++) {
		emit(parity[i - 1] === 'L' ? EAN_L[Number(digits[i])] : EAN_G[Number(digits[i])]);
	}

	emit('01010');

	for (let i = 7; i <= 12; i++) emit(EAN_R[Number(digits[i])]);

	emit('101');

	return out;
}

/**
 * Un code EAN-13 mal formé ne peut pas être dessiné en EAN-13 : le rendre en Code 39 donnerait un
 * code qui scanne, mais pas la bonne donnée. On préfère ne rien afficher et le dire.
 */
export function linearCode(value: string, codeType: string): CodeElement[] | null {
	return codeType === 'ean_13' ? ean13(value) : code39(value);
}
