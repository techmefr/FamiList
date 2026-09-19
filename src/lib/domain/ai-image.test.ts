import { describe, it, expect } from 'vitest';
import {
	buildImageRequest,
	dishPhotoPrompt,
	IMAGE_MODEL,
	parseImageReply,
	recipePhotoPath
} from './ai-image';
import { providerById } from './ai';

const KEY = 'secret-de-la-personne';

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

describe('buildImageRequest', () => {
	it('appelle le bon modele avec la cle en en-tete, jamais dans l’adresse', () => {
		const gemini = providerById('gemini')!;
		const request = buildImageRequest(gemini, KEY, 'un plat');

		expect(request.url).toBe(`${gemini.base}/models/${IMAGE_MODEL}:generateContent`);
		expect(request.url).not.toContain(KEY);
		expect(request.headers['x-goog-api-key']).toBe(KEY);
	});
});

describe('parseImageReply', () => {
	it('lit les octets en base64 et le type mime', () => {
		const payload = {
			candidates: [
				{ content: { parts: [{ inlineData: { data: 'QQ==', mimeType: 'image/png' } }] } }
			]
		};

		expect(parseImageReply(payload)).toEqual({ base64: 'QQ==', mimeType: 'image/png' });
	});

	it("renvoie null si la forme ne correspond pas a une image", () => {
		expect(parseImageReply({ candidates: [{ content: { parts: [{ text: 'pas une image' }] } }] })).toBeNull();
		expect(parseImageReply(null)).toBeNull();
		expect(parseImageReply({})).toBeNull();
	});
});

describe('recipePhotoPath', () => {
	it('range la photo sous le foyer, pas sous la recette seule', () => {
		expect(recipePhotoPath('menage-1', 'recette-1', 'image/png')).toBe('menage-1/recette-1.png');
		expect(recipePhotoPath('menage-1', 'recette-1', 'image/jpeg')).toBe('menage-1/recette-1.jpg');
	});
});
