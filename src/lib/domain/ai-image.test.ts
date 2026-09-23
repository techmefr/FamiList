import { describe, it, expect } from 'vitest';
import {
	dishPhotoPrompt,
	openverseSearchUrl,
	pickImageResult,
	pollinationsImageUrl,
	recipeImageSearchQuery,
	recipePhotoPath
} from './ai-image';

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
		const url = pollinationsImageUrl('un plat & sa sauce', 42);

		expect(url).toBe('https://image.pollinations.ai/prompt/un%20plat%20%26%20sa%20sauce?seed=42');
	});

	it('change quand le seed change, pour permettre de regenerer', () => {
		const first = pollinationsImageUrl('nems', 1);
		const second = pollinationsImageUrl('nems', 2);

		expect(first).not.toBe(second);
	});
});

describe('recipePhotoPath', () => {
	it('range la photo sous le foyer, pas sous la recette seule', () => {
		expect(recipePhotoPath('menage-1', 'recette-1', 'image/png')).toBe('menage-1/recette-1.png');
		expect(recipePhotoPath('menage-1', 'recette-1', 'image/jpeg')).toBe('menage-1/recette-1.jpg');
	});
});

describe('recipeImageSearchQuery', () => {
	it('combine le nom du plat et ses ingredients principaux', () => {
		const query = recipeImageSearchQuery('Poulet basquaise', ['poivron', 'tomate', 'poulet']);
		expect(query).toBe('Poulet basquaise poivron tomate poulet');
	});

	it('limite le nombre d ingredients repris dans la recherche', () => {
		const query = recipeImageSearchQuery('Ratatouille', ['aubergine', 'courgette', 'tomate', 'poivron', 'oignon']);
		expect(query).toBe('Ratatouille aubergine courgette tomate');
	});

	it('ignore les ingredients vides et reste utilisable sans ingredient', () => {
		expect(recipeImageSearchQuery('Salade', ['', '  '])).toBe('Salade');
	});
});

describe('openverseSearchUrl', () => {
	it('construit une requete keyless vers openverse, filtree sur les licences reutilisables', () => {
		const url = openverseSearchUrl('tarte aux pommes');

		expect(url.startsWith('https://api.openverse.org/v1/images/?')).toBe(true);
		expect(url).toContain('q=tarte+aux+pommes');
		expect(url).toContain('license_type=commercial%2Cmodification');
	});
});

describe('pickImageResult', () => {
	it('prend la miniature du premier resultat, ouverte en CORS', () => {
		const payload = {
			results: [
				{ id: 'abc', thumbnail: 'https://api.openverse.org/v1/images/abc/thumb/', url: 'https://source.example/img.jpg' }
			]
		};

		expect(pickImageResult(payload)).toBe('https://api.openverse.org/v1/images/abc/thumb/');
	});

	it('retombe sur l url d origine quand aucune miniature n est fournie', () => {
		const payload = { results: [{ id: 'abc', url: 'https://source.example/img.jpg' }] };

		expect(pickImageResult(payload)).toBe('https://source.example/img.jpg');
	});

	it('renvoie null quand il n y a aucun resultat', () => {
		expect(pickImageResult({ results: [] })).toBeNull();
		expect(pickImageResult({})).toBeNull();
		expect(pickImageResult(null)).toBeNull();
	});
});
