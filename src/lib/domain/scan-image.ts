import type { CodeType } from '$domain/code-format';
import { expandUpcE } from '$domain/barcode';

/**
 * The formats we ask a decoder for.
 *
 * A loyalty card is almost never an EAN-13: retailers mostly print Code 128, sometimes ITF or UPC-A.
 * Asking for only three formats means answering "no code found" on most real cards.
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
 * The format read, brought back to those the card knows how to redraw.
 *
 * `null` is not a read failure: the code value is right, it is its drawing we cannot produce. The screen
 * then falls back on the format guessed from what was typed.
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

	// UPC-A is an EAN-13 whose first digit is zero: the reader gives twelve digits, the thirteenth is that
	// implicit zero. The EAN-13 drawing is therefore exact, up to that prefix. UPC-E is the same code
	// compressed, which we expand again rather than encode.
	if (lower.includes('upca') || lower.includes('upce')) return 'ean_13';

	return null;
}

/** Both UPC variants are brought back to the matching EAN-13, which the card knows how to draw. */
export function normalizeValue(value: string, raw: string): string {
	const lower = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
	const digits = value.trim();

	if (lower.includes('upca') && /^\d{12}$/.test(digits)) return `0${digits}`;
	if (lower.includes('upce')) return expandUpcE(digits) ?? value;

	return value;
}

/**
 * How much to shrink an image by before handing it to the fallback decoder.
 *
 * A phone photo is several thousand pixels wide. On a barcode, that resolution works against the reading:
 * the grain of the paper and the sensor noise become bars. Shrunk, the same photo goes through.
 */
export function scanScale(width: number, height: number, max = 1600): number {
	const largest = Math.max(width, height);
	if (largest <= max || largest === 0) return 1;

	return max / largest;
}
