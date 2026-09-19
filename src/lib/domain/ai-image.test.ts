import { describe, it, expect } from 'vitest';
import { dishPhotoPrompt, pollinationsImageUrl, recipePhotoPath } from './ai-image';

describe('dishPhotoPrompt', () => {
	it("nomme le plat et ses ingredients", () => {
		const prompt = dishPhotoPrompt('Tarte aux pommes', ['pommes', 'pate feuilletee']);
		expect(prompt).toContain('Tarte aux pommes');
		expect(prompt).toContain('pommes, pate feuilletee');
	});

	it('reste utilisable sans ingredient', () => {
		const prompt = dishPhotoPrompt('Salade', []);
		expect(prompt).toContain('Salade');
	});
});

describe('pollinationsImageUrl', () => {
	it('encode le prompt dans le chemin, sans cle ni corps', () => {
		const url = pollinationsImageUrl('un plat & sa sauce');

		expect(url).toBe('https://image.pollinations.ai/prompt/un%20plat%20%26%20sa%20sauce');
	});
});

describe('recipePhotoPath', () => {
	it('range la photo sous le foyer, pas sous la recette seule', () => {
		expect(recipePhotoPath('menage-1', 'recette-1', 'image/png')).toBe('menage-1/recette-1.png');
		expect(recipePhotoPath('menage-1', 'recette-1', 'image/jpeg')).toBe('menage-1/recette-1.jpg');
	});
});
