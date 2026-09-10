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

/** EAN-8 : quatre chiffres à gauche en jeu L, quatre à droite en jeu R, pas d'alternance. */
export function ean8CheckDigit(seven: string): number {
	const sum = seven
		.slice(0, 7)
		.split('')
		.reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);

	return (10 - (sum % 10)) % 10;
}

export function normalizeEan8(value: string): string | null {
	const digits = String(value).replace(/\D/g, '');

	if (digits.length === 7) return digits + ean8CheckDigit(digits);
	if (digits.length === 8 && Number(digits[7]) === ean8CheckDigit(digits)) return digits;

	return null;
}

export function ean8(value: string): CodeElement[] | null {
	const digits = normalizeEan8(value);
	if (!digits) return null;

	const out: CodeElement[] = [];
	const emit = (pattern: string) => {
		for (const bit of pattern) out.push({ width: 1, dark: bit === '1' });
	};

	emit('101');
	for (let i = 0; i < 4; i++) emit(EAN_L[Number(digits[i])]);
	emit('01010');
	for (let i = 4; i < 8; i++) emit(EAN_R[Number(digits[i])]);
	emit('101');

	return out;
}

/**
 * UPC-E est un UPC-A comprimé : la position du dernier chiffre dit où réinsérer les zéros. On le
 * réétend plutôt que de l'encoder, parce qu'un lecteur rend la même donnée dans les deux cas et
 * qu'un EAN-13 se dessine déjà.
 */
export function expandUpcE(value: string): string | null {
	const digits = String(value).replace(/\D/g, '');
	if (digits.length !== 8 || (digits[0] !== '0' && digits[0] !== '1')) return null;

	const system = digits[0];
	const [x1, x2, x3, x4, x5, x6] = digits.slice(1, 7);
	const check = digits[7];

	const body =
		x6 <= '2'
			? `${x1}${x2}${x6}0000${x3}${x4}${x5}`
			: x6 === '3'
				? `${x1}${x2}${x3}00000${x4}${x5}`
				: x6 === '4'
					? `${x1}${x2}${x3}${x4}00000${x5}`
					: `${x1}${x2}${x3}${x4}${x5}0000${x6}`;

	const upca = `${system}${body}`;

	// La clé accompagne la forme comprimée sans être recalculée : si elle ne correspond pas à
	// l'UPC-A obtenu, c'est la lecture qui est fausse, et il vaut mieux ne rien dessiner.
	if (ean13CheckDigit(`0${upca}`) !== Number(check)) return null;

	return `0${upca}${check}`;
}

/**
 * ITF : les chiffres vont par paires, le premier porté par les barres, le second par les espaces
 * qui les séparent. Un nombre impair de chiffres n'est donc pas représentable.
 */
const ITF_DIGITS = [
	'00110', '10001', '01001', '11000', '00101',
	'10100', '01100', '00011', '10010', '01010'
];

export function itf(value: string): CodeElement[] | null {
	const digits = String(value).replace(/\D/g, '');
	if (digits.length === 0 || digits.length % 2 !== 0) return null;

	const out: CodeElement[] = [];

	for (const dark of [true, false, true, false]) out.push({ width: NARROW, dark });

	for (let i = 0; i < digits.length; i += 2) {
		const bars = ITF_DIGITS[Number(digits[i])];
		const spaces = ITF_DIGITS[Number(digits[i + 1])];

		for (let j = 0; j < 5; j++) {
			out.push({ width: bars[j] === '1' ? WIDE : NARROW, dark: true });
			out.push({ width: spaces[j] === '1' ? WIDE : NARROW, dark: false });
		}
	}

	out.push({ width: WIDE, dark: true });
	out.push({ width: NARROW, dark: false });
	out.push({ width: NARROW, dark: true });

	return out;
}

/**
 * Code 93. Les motifs tiennent sur neuf modules dont le premier est toujours une barre, et deux
 * caractères de contrôle — pondérations 20 puis 15 — ferment la donnée.
 */
const CODE_93_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%';
const CODE_93_PATTERNS = [
	0x114, 0x148, 0x144, 0x142, 0x128, 0x124, 0x122, 0x150, 0x112, 0x10a,
	0x1a8, 0x1a4, 0x1a2, 0x194, 0x192, 0x18a, 0x168, 0x164, 0x162, 0x134,
	0x11a, 0x158, 0x14c, 0x146, 0x12c, 0x116, 0x1b4, 0x1b2, 0x1ac, 0x1a6,
	0x196, 0x19a, 0x16c, 0x166, 0x136, 0x13a,
	0x12e, 0x1d4, 0x1d2, 0x1ca, 0x16e, 0x176, 0x1ae
];
const CODE_93_START = 0x15e;

function code93CheckIndex(values: number[], weightMax: number): number {
	let weight = 1;
	let total = 0;

	for (let i = values.length - 1; i >= 0; i--) {
		total += weight * values[i];
		if (++weight > weightMax) weight = 1;
	}

	return total % 47;
}

export function code93(value: string): CodeElement[] | null {
	const clean = String(value).toUpperCase();
	const values: number[] = [];

	for (const char of clean) {
		const index = CODE_93_ALPHABET.indexOf(char);
		if (index < 0) return null;
		values.push(index);
	}

	if (values.length === 0) return null;

	values.push(code93CheckIndex(values, 20));
	values.push(code93CheckIndex(values, 15));

	const out: CodeElement[] = [];
	const emit = (pattern: number) => {
		for (let bit = 8; bit >= 0; bit--) {
			out.push({ width: 1, dark: ((pattern >> bit) & 1) === 1 });
		}
	};

	emit(CODE_93_START);
	for (const index of values) emit(CODE_93_PATTERNS[index]);
	emit(CODE_93_START);
	// Barre de terminaison : sans elle le motif d'arrêt se confond avec le dernier espace.
	out.push({ width: 1, dark: true });

	return out;
}

/**
 * Code 128, le format le plus répandu sur les cartes de fidélité. Chaque symbole vaut onze
 * modules répartis en six éléments, barre en premier.
 */
const CODE_128_PATTERNS = [
	'212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
	'221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
	'221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
	'212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
	'231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
	'231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
	'314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
	'112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
	'111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
	'214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
	'114131','311141','411131','211412','211214','211232','2331112'
];
const CODE_128_START_B = 104;
const CODE_128_START_C = 105;
const CODE_128_STOP = 106;

/**
 * Le jeu C code deux chiffres par symbole : sur un numéro de carte, il divise la largeur du
 * tracé par deux, ce qui compte sur un écran de téléphone tenu devant une douchette.
 */
function code128Values(value: string): number[] | null {
	if (/^\d+$/.test(value) && value.length % 2 === 0) {
		const values = [CODE_128_START_C];

		for (let i = 0; i < value.length; i += 2) values.push(Number(value.slice(i, i + 2)));

		return values;
	}

	const values = [CODE_128_START_B];

	for (const char of value) {
		const code = char.charCodeAt(0);
		if (code < 32 || code > 126) return null;
		values.push(code - 32);
	}

	return values.length > 1 ? values : null;
}

export function code128(value: string): CodeElement[] | null {
	const clean = String(value).trim();
	if (!clean) return null;

	const values = code128Values(clean);
	if (!values) return null;

	const checksum = values.reduce(
		(total, symbol, index) => total + symbol * (index === 0 ? 1 : index),
		0
	);
	values.push(checksum % 103, CODE_128_STOP);

	const out: CodeElement[] = [];

	for (const symbol of values) {
		const widths = CODE_128_PATTERNS[symbol];

		for (let i = 0; i < widths.length; i++) {
			out.push({ width: Number(widths[i]), dark: i % 2 === 0 });
		}
	}

	return out;
}

const ENCODERS: Record<string, (value: string) => CodeElement[] | null> = {
	code_39: code39,
	code_93: code93,
	code_128: code128,
	ean_13: ean13,
	ean_8: ean8,
	itf
};

/**
 * Un code mal formé pour son format n'est pas rabattu sur un autre : le tracé scannerait, mais
 * renverrait une donnée qui n'est pas celle de la carte. On préfère ne rien afficher et le dire.
 */
export function linearCode(value: string, codeType: string): CodeElement[] | null {
	return (ENCODERS[codeType] ?? code39)(value);
}
