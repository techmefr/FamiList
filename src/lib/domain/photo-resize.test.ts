import { describe, expect, it } from 'vitest';
import { fitWithin } from './photo-resize';

describe('fitWithin', () => {
	it('reduit le plus grand cote a la limite en gardant les proportions', () => {
		expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
		expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
	});

	it('laisse une image deja assez petite telle quelle', () => {
		expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
	});

	it('tient une image sans dimension', () => {
		expect(fitWithin(0, 0, 1600)).toEqual({ width: 0, height: 0 });
	});
});
