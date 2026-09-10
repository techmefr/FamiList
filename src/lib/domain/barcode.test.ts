import { describe, expect, it } from 'vitest';
import {
	BarcodeFormat,
	BinaryBitmap,
	DecodeHintType,
	HybridBinarizer,
	MultiFormatReader,
	RGBLuminanceSource
} from '@zxing/library';
import { CODE_TYPES, isMatrixFormat } from './code-format';
import type { CodeElement } from './barcode';
import {
	code128,
	code39,
	code93,
	ean13,
	ean13CheckDigit,
	ean8,
	ean8CheckDigit,
	expandUpcE,
	itf,
	linearCode,
	normalizeEan13,
	normalizeEan8
} from './barcode';

const pattern = (elements: { width: number; dark: boolean }[]) =>
	elements.map((el) => (el.dark ? '1' : '0').repeat(el.width)).join('');

/**
 * Un code-barres faux se dessine très bien et ne scanne pas : comparer le tracé à lui-même ne
 * prouverait rien. On le relit donc avec zxing, le décodeur que l'application embarque déjà en
 * secours, sur une image en noir et blanc construite à partir des barres produites.
 */
const SCALE = 3;
const QUIET = 12;
const ROWS = 30;
const WHITE = 0xffffffff | 0;
const BLACK = 0xff000000 | 0;

function decode(elements: CodeElement[] | null, format: BarcodeFormat): string | null {
	if (!elements) return null;

	const modules = elements.reduce((total, element) => total + element.width, 0) + QUIET * 2;
	const width = modules * SCALE;
	const row = new Int32Array(width).fill(WHITE);
	let x = QUIET;

	for (const element of elements) {
		if (element.dark) {
			for (let i = 0; i < element.width * SCALE; i++) row[x * SCALE + i] = BLACK;
		}

		x += element.width;
	}

	const pixels = new Int32Array(width * ROWS);
	for (let y = 0; y < ROWS; y++) pixels.set(row, y * width);

	const reader = new MultiFormatReader();
	reader.setHints(
		new Map<DecodeHintType, unknown>([
			[DecodeHintType.POSSIBLE_FORMATS, [format]],
			[DecodeHintType.TRY_HARDER, true]
		])
	);

	try {
		return reader
			.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, width, ROWS))))
			.getText();
	} catch {
		return null;
	}
}

describe('ean13CheckDigit', () => {
	// Codes réels, clé vérifiable à la main.
	it.each([
		['400638133393', 1],
		['978020137962', 4],
		['501234567890', 0]
	])('%s -> %i', (twelve, expected) => {
		expect(ean13CheckDigit(twelve)).toBe(expected);
	});
});

describe('normalizeEan13', () => {
	it('complète douze chiffres avec leur clé', () => {
		expect(normalizeEan13('400638133393')).toBe('4006381333931');
	});

	it('accepte treize chiffres dont la clé est juste', () => {
		expect(normalizeEan13('4006381333931')).toBe('4006381333931');
	});

	it('refuse treize chiffres dont la clé est fausse', () => {
		expect(normalizeEan13('4006381333930')).toBeNull();
	});

	it('ignore les séparateurs de saisie', () => {
		expect(normalizeEan13('400 6381 33393')).toBe('4006381333931');
	});

	it('refuse une longueur qui ne peut pas former un EAN-13', () => {
		expect(normalizeEan13('12345')).toBeNull();
	});
});

describe('ean13', () => {
	it('encadre le code des gardes normalisées', () => {
		const bits = pattern(ean13('4006381333931')!);

		expect(bits.startsWith('101')).toBe(true);
		expect(bits.endsWith('101')).toBe(true);
		expect(bits.slice(45, 50)).toBe('01010');
	});

	it('produit les 95 modules de la norme', () => {
		expect(pattern(ean13('4006381333931')!)).toHaveLength(95);
	});

	it('code le premier chiffre par l alternance des jeux, sans le dessiner', () => {
		// Deux codes qui ne diffèrent que par leur premier chiffre doivent donner des tracés
		// différents, sinon le lecteur lirait le même produit.
		expect(pattern(ean13('400638133393')!)).not.toBe(pattern(ean13('500638133393')!));
	});

	it('rend null sur une saisie non conforme', () => {
		expect(ean13('pas un code')).toBeNull();
	});
});

describe('code39', () => {
	it('encadre la donnée du caractère de départ et d arrêt', () => {
		// « * » occupe 15 modules : six étroits et trois larges.
		const STAR = 15;
		const bits = pattern(code39('A'));
		const star = pattern(code39('')).slice(0, STAR);

		expect(bits.slice(0, STAR)).toBe(star);
		expect(bits.slice(-STAR)).toBe(star);
	});

	it('ignore les caractères hors alphabet plutôt que de produire un code faux', () => {
		expect(pattern(code39('AB'))).toBe(pattern(code39('A@B')));
	});

	it('traite la saisie sans tenir compte de la casse', () => {
		expect(pattern(code39('abc'))).toBe(pattern(code39('ABC')));
	});
});

describe('ean8CheckDigit', () => {
	it.each([
		['9638507', 4],
		['5512345', 7]
	])('%s -> %i', (seven, expected) => {
		expect(ean8CheckDigit(seven)).toBe(expected);
	});
});

describe('normalizeEan8', () => {
	it('complète sept chiffres avec leur clé', () => {
		expect(normalizeEan8('9638507')).toBe('96385074');
	});

	it('refuse huit chiffres dont la clé est fausse', () => {
		expect(normalizeEan8('96385075')).toBeNull();
	});
});

describe('ean8', () => {
	it('produit les 67 modules de la norme', () => {
		expect(pattern(ean8('96385074')!)).toHaveLength(67);
	});

	it('rend null sur une saisie non conforme', () => {
		expect(ean8('123')).toBeNull();
	});
});

describe('itf', () => {
	it('refuse un nombre impair de chiffres, que le format ne peut pas porter', () => {
		expect(itf('1234567')).toBeNull();
	});

	it('ouvre sur quatre éléments étroits et ferme sur une barre large', () => {
		const elements = itf('1234')!;

		expect(elements.slice(0, 4).every((element) => element.width === 1)).toBe(true);
		expect(elements.at(-3)).toEqual({ width: 3, dark: true });
	});
});

describe('code93', () => {
	it('ajoute deux caractères de contrôle et la barre de terminaison', () => {
		// Départ, six caractères, deux contrôles, arrêt : dix motifs de neuf modules, plus la barre.
		expect(pattern(code93('AB1234')!)).toHaveLength(10 * 9 + 1);
	});

	it('rend null sur un caractère hors alphabet plutôt qu un code tronqué', () => {
		expect(code93('abc_def')).toBeNull();
	});
});

describe('code128', () => {
	it('code deux chiffres par symbole quand la donnée est numérique et de longueur paire', () => {
		// Huit chiffres : départ, quatre symboles, contrôle, arrêt — soit 6 x 11 + 13 modules.
		expect(pattern(code128('12345678')!)).toHaveLength(6 * 11 + 13);
	});

	it('bascule sur le jeu alphanumérique dès qu un caractère n est pas un chiffre', () => {
		expect(pattern(code128('FC847')!)).toHaveLength(7 * 11 + 13);
	});

	it('rend null sur un caractère hors ASCII imprimable', () => {
		expect(code128('café')).toBeNull();
	});

	it('rend null sur une saisie vide', () => {
		expect(code128('   ')).toBeNull();
	});
});

describe('expandUpcE', () => {
	it.each([
		['01234565', '0012345000065'],
		['04252614', '0042100005264']
	])('réétend %s en %s', (compressed, expanded) => {
		expect(expandUpcE(compressed)).toBe(expanded);
	});

	it('refuse une clé qui ne correspond pas à l UPC-A obtenu', () => {
		expect(expandUpcE('01234566')).toBeNull();
	});
});

const RELECTURE: [string, BarcodeFormat, string][] = [
	['ean_13', BarcodeFormat.EAN_13, '4006381333931'],
	['ean_8', BarcodeFormat.EAN_8, '96385074'],
	['code_39', BarcodeFormat.CODE_39, 'FC-8471-8803'],
	['code_93', BarcodeFormat.CODE_93, 'FC-8471-8803'],
	['code_128', BarcodeFormat.CODE_128, 'FC-8471-8803'],
	['code_128', BarcodeFormat.CODE_128, '9352004421305299'],
	['itf', BarcodeFormat.ITF, '9352004421305299']
];

describe('relecture par un décodeur indépendant', () => {
	it('couvre tous les formats en barres proposés à la saisie', () => {
		// Un format proposé sans vecteur de relecture serait un format dessiné sans preuve qu'il
		// scanne : c'est exactement ce qu'on cherche à éviter.
		const couverts = new Set(RELECTURE.map(([codeType]) => codeType));

		expect(CODE_TYPES.filter((type) => !isMatrixFormat(type)).every((type) => couverts.has(type)))
			.toBe(true);
	});

	it.each(RELECTURE)('%s rend la donnée d origine une fois relu', (codeType, format, value) => {
		expect(decode(linearCode(value, codeType), format)).toBe(value);
	});

	it('relit un UPC-E réétendu comme l UPC-A dont il est la forme comprimée', () => {
		// Un EAN-13 qui commence par zéro est un UPC-A : le décodeur le rend sous cette forme, sans
		// le zéro de tête. C'est la même donnée, et c'est celle qu'imprime la carte en plastique.
		const expanded = expandUpcE('01234565')!;

		expect(decode(linearCode(expanded, 'ean_13'), BarcodeFormat.EAN_13)).toBe(expanded.slice(1));
	});
});

describe('linearCode', () => {
	it('refuse de dessiner un EAN-13 invalide en Code 39', () => {
		// Sinon le code scannerait, mais renverrait une donnée qui n est pas celle de la carte.
		expect(linearCode('12345', 'ean_13')).toBeNull();
	});

	it('rend le Code 39 pour un format qu il ne connaît pas', () => {
		expect(linearCode('9352004421', 'codabar')).not.toBeNull();
	});
});
