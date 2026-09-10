import type { CodeType } from '$domain/code-format';
import { expandUpcE } from '$domain/barcode';

/**
 * Les formats qu'on demande à un décodeur.
 *
 * Une carte de fidélité n'est presque jamais un EAN-13 : les enseignes impriment surtout du
 * Code 128, parfois de l'ITF ou de l'UPC-A. Ne demander que trois formats, c'est répondre
 * « aucun code trouvé » sur la majorité des cartes réelles.
 */
export const SCAN_FORMATS = [
	'qr_code',
	'ean_13',
	'ean_8',
	'code_39',
	'code_93',
	'code_128',
	'itf',
	'upc_a',
	'upc_e',
	'codabar',
	'data_matrix',
	'aztec',
	'pdf417'
] as const;

/**
 * Le format lu, ramené à ceux que la carte sait redessiner.
 *
 * `null` n'est pas un échec de lecture : la valeur du code est bonne, c'est son dessin qu'on ne
 * sait pas produire. L'écran retombe alors sur le format deviné d'après la saisie.
 */
export function normalizeFormat(raw: string): CodeType | null {
	const lower = raw.toLowerCase().replace(/[^a-z0-9]/g, '');

	if (lower.includes('qr')) return 'qr_code';
	if (lower.includes('ean13')) return 'ean_13';
	if (lower.includes('ean8')) return 'ean_8';
	if (lower.includes('code39')) return 'code_39';
	if (lower.includes('code93')) return 'code_93';
	if (lower.includes('code128')) return 'code_128';
	if (lower.includes('itf')) return 'itf';

	// UPC-A est un EAN-13 dont le premier chiffre est zéro : le lecteur rend douze chiffres, le
	// treizième est ce zéro implicite. Le dessin EAN-13 est donc exact, à ce préfixe près. UPC-E
	// est le même code comprimé, qu'on réétend plutôt que de l'encoder.
	if (lower.includes('upca') || lower.includes('upce')) return 'ean_13';

	return null;
}

/** Les deux variantes UPC sont ramenées à l'EAN-13 correspondant, que la carte sait dessiner. */
export function normalizeValue(value: string, raw: string): string {
	const lower = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
	const digits = value.trim();

	if (lower.includes('upca') && /^\d{12}$/.test(digits)) return `0${digits}`;
	if (lower.includes('upce')) return expandUpcE(digits) ?? value;

	return value;
}

/**
 * De combien réduire une image avant de la donner au décodeur de secours.
 *
 * Une photo de téléphone fait plusieurs milliers de pixels de large. Sur un code à barres, cette
 * résolution travaille contre la lecture : le grain du papier et le bruit du capteur deviennent
 * des barres. Réduite, la même photo passe.
 */
export function scanScale(width: number, height: number, max = 1600): number {
	const largest = Math.max(width, height);
	if (largest <= max || largest === 0) return 1;

	return max / largest;
}
