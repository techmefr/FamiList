import { describe, expect, it } from 'vitest';
import { SCREENSHOT_MAX_DIM, fitWithin } from './screenshot';

describe('fitWithin', () => {
	it('ne change rien à une image déjà plus petite que la limite', () => {
		expect(fitWithin(400, 300, 1280)).toEqual({ width: 400, height: 300 });
	});

	it('ne change rien à une image pile à la limite', () => {
		expect(fitWithin(1280, 720, 1280)).toEqual({ width: 1280, height: 720 });
	});

	it('réduit une image large en gardant le ratio', () => {
		expect(fitWithin(2560, 1440, 1280)).toEqual({ width: 1280, height: 720 });
	});

	it('réduit une image en portrait selon sa hauteur', () => {
		expect(fitWithin(1080, 2400, 1200)).toEqual({ width: 540, height: 1200 });
	});

	it('réduit une image carrée sur ses deux côtés à parts égales', () => {
		expect(fitWithin(3000, 3000, 1280)).toEqual({ width: 1280, height: 1280 });
	});

	it("n'agrandit jamais une image plus petite que la limite", () => {
		expect(fitWithin(100, 50, SCREENSHOT_MAX_DIM)).toEqual({ width: 100, height: 50 });
	});

	it('garde au moins un pixel sur chaque côté', () => {
		expect(fitWithin(1, 1, 1280)).toEqual({ width: 1, height: 1 });
	});
});
