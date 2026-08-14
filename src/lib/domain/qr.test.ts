import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { qrEncode } from './qr';

/**
 * Un QR n'a d'intérêt que s'il se relit. On vérifie donc l'encodeur en le décodant avec une
 * implémentation indépendante, plutôt qu'en comparant sa sortie à elle-même. jsqr n'est utilisé
 * qu'ici : l'application, elle, ne dépend de rien pour afficher un code.
 */
const SCALE = 4;
const QUIET = 4;

function decode(text: string) {
	const { size, modules } = qrEncode(text);
	const side = (size + QUIET * 2) * SCALE;
	const pixels = new Uint8ClampedArray(side * side * 4).fill(255);

	for (let row = 0; row < size; row++) {
		for (let col = 0; col < size; col++) {
			if (!modules[row][col]) continue;

			for (let dy = 0; dy < SCALE; dy++) {
				for (let dx = 0; dx < SCALE; dx++) {
					const y = (row + QUIET) * SCALE + dy;
					const x = (col + QUIET) * SCALE + dx;
					const offset = (y * side + x) * 4;
					pixels[offset] = 0;
					pixels[offset + 1] = 0;
					pixels[offset + 2] = 0;
				}
			}
		}
	}

	return jsQR(pixels, side, side)?.data ?? null;
}

describe('qrEncode', () => {
	it.each([
		['FC-8471-8803'],
		['9352004421'],
		['270098155207'],
		['Fraîcheur & Co — fidélité'],
		['1']
	])('produit un code relisible pour %s', (value) => {
		expect(decode(value)).toBe(value);
	});

	it('reste relisible sur une donnée assez longue pour changer de version', () => {
		const long = 'FAMILIST-' + '9'.repeat(120);
		expect(decode(long)).toBe(long);
	});

	it('donne toujours le même code pour la même entrée', () => {
		expect(qrEncode('9352004421')).toEqual(qrEncode('9352004421'));
	});

	it('grandit avec la donnée', () => {
		expect(qrEncode('9'.repeat(120)).size).toBeGreaterThan(qrEncode('9').size);
	});

	it('place les trois motifs de repérage', () => {
		const { size, modules } = qrEncode('9352004421');
		const corners: [number, number][] = [
			[0, 0],
			[0, size - 7],
			[size - 7, 0]
		];

		for (const [row, col] of corners) {
			expect(modules[row][col]).toBe(true);
			expect(modules[row + 1][col + 1]).toBe(false);
			expect(modules[row + 3][col + 3]).toBe(true);
		}
	});
});
