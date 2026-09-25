import { describe, it, expect } from 'vitest';
import {
	dishPhotoPrompt,
	IMAGE_SEARCH_PAGE_SIZE,
	imageSearchResults,
	openverseSearchUrl,
	photoFailureKey,
	photoFailureOfStatus,
	pollinationsImageUrl,
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

describe('openverseSearchUrl', () => {
	it('construit une requete keyless vers openverse, filtree sur les licences reutilisables', () => {
		const url = openverseSearchUrl('tarte aux pommes');

		expect(url.startsWith('https://api.openverse.org/v1/images/?')).toBe(true);
		expect(url).toContain('q=tarte+aux+pommes');
		expect(url).toContain('license_type=commercial%2Cmodification');
	});

	it('demande assez de resultats pour laisser le choix', () => {
		expect(openverseSearchUrl('quiche')).toContain(`page_size=${IMAGE_SEARCH_PAGE_SIZE}`);
		expect(IMAGE_SEARCH_PAGE_SIZE).toBeGreaterThan(1);
	});
});

describe('imageSearchResults', () => {
	it('garde chaque resultat avec sa miniature ouverte en CORS et son credit', () => {
		const payload = {
			results: [
				{
					id: 'abc',
					title: ' Quiche ',
					thumbnail: 'https://api.openverse.org/v1/images/abc/thumb/',
					url: 'https://source.example/img.jpg',
					creator: 'mastermaq',
					license: 'by-sa',
					license_version: '2.0'
				},
				{ id: 'def', url: 'https://source.example/other.jpg' }
			]
		};

		expect(imageSearchResults(payload)).toEqual([
			{
				id: 'abc',
				previewUrl: 'https://api.openverse.org/v1/images/abc/thumb/',
				title: 'Quiche',
				creator: 'mastermaq',
				license: 'BY-SA 2.0'
			},
			{ id: 'def', previewUrl: 'https://source.example/other.jpg', title: '', creator: '', license: '' }
		]);
	});

	it('ecarte un resultat sans image ni identifiant', () => {
		expect(imageSearchResults({ results: [{ id: 'abc' }, { thumbnail: 'https://x.example/a.jpg' }] })).toEqual([]);
	});

	it('renvoie une liste vide quand la reponse est vide ou illisible', () => {
		expect(imageSearchResults({ results: [] })).toEqual([]);
		expect(imageSearchResults({})).toEqual([]);
		expect(imageSearchResults(null)).toEqual([]);
	});
});

describe('photoFailureOfStatus', () => {
	it('lit 401, 402 et 403 comme un service qui exige une cle', () => {
		expect(photoFailureOfStatus(401)).toBe('unavailable');
		expect(photoFailureOfStatus(402)).toBe('unavailable');
		expect(photoFailureOfStatus(403)).toBe('unavailable');
	});

	it('lit les autres erreurs comme un service injoignable, a reessayer', () => {
		expect(photoFailureOfStatus(500)).toBe('unreachable');
		expect(photoFailureOfStatus(429)).toBe('unreachable');
	});
});

describe('photoFailureKey', () => {
	it('donne un message distinct a chaque echec', () => {
		const keys = (['offline', 'unavailable', 'unreachable', 'not-found', 'upload'] as const).map(photoFailureKey);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
