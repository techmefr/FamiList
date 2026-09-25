import { describe, it, expect } from 'vitest';
import {
	dishPhotoPrompt,
	IMAGE_SEARCH_PAGE_SIZE,
	imageSearchResults,
	openverseSearchUrl,
	photoFailureKey,
	photoFailureOfStatus,
	decodeDataUrl,
	OPENROUTER_IMAGE_MODEL,
	openRouterFailureOfStatus,
	openRouterImageRequest,
	openRouterImageUrl,
	recipeImagePrompt,
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

describe('recipeImagePrompt (#306)', () => {
	it("envoie la description ecrite par l'IA plutot que le gabarit", () => {
		const prompt = recipeImagePrompt('Golden fried spring rolls on lettuce', 'Nems', ['porc']);

		expect(prompt).toContain('Golden fried spring rolls on lettuce');
		expect(prompt).not.toContain('Nems');
	});

	it('retombe sur le gabarit sans description', () => {
		expect(recipeImagePrompt(undefined, 'Nems', ['porc'])).toBe(dishPhotoPrompt('Nems', ['porc']));
		expect(recipeImagePrompt('   ', 'Nems', [])).toBe(dishPhotoPrompt('Nems', []));
	});
});

describe('openRouterImageRequest (#306)', () => {
	it('met la cle dans un en-tete et demande une image seule', () => {
		const request = openRouterImageRequest('cle-secrete', 'a dish', 7);

		expect(request.url).toBe('https://openrouter.ai/api/v1/chat/completions');
		expect(request.url).not.toContain('cle-secrete');
		expect(request.headers.authorization).toBe('Bearer cle-secrete');
		expect(JSON.parse(request.body)).toEqual({
			model: OPENROUTER_IMAGE_MODEL,
			modalities: ['image'],
			seed: 7,
			messages: [{ role: 'user', content: 'a dish' }]
		});
	});
});

describe('openRouterImageUrl (#306)', () => {
	it('lit la premiere image renvoyee', () => {
		const payload = {
			choices: [{ message: { images: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }] } }]
		};
		expect(openRouterImageUrl(payload)).toBe('data:image/png;base64,AAAA');
	});

	it("renvoie null sans image, ou pour une adresse qui n'est pas une image en ligne", () => {
		expect(openRouterImageUrl(null)).toBeNull();
		expect(openRouterImageUrl({ choices: [{ message: { content: 'non' } }] })).toBeNull();
		expect(
			openRouterImageUrl({ choices: [{ message: { images: [{ image_url: { url: 'https://x.test/a.png' } }] } }] })
		).toBeNull();
	});
});

describe('decodeDataUrl (#306)', () => {
	it('rend les octets et le type', () => {
		const decoded = decodeDataUrl('data:image/png;base64,AQID');
		expect(decoded?.mimeType).toBe('image/png');
		expect(Array.from(decoded?.bytes ?? [])).toEqual([1, 2, 3]);
	});

	it("refuse ce qui n'est pas une image en base64", () => {
		expect(decodeDataUrl('data:text/plain;base64,AQID')).toBeNull();
		expect(decodeDataUrl('data:image/png;base64,@@@')).toBeNull();
	});
});

describe('openRouterFailureOfStatus (#306)', () => {
	it("distingue un solde vide d'une cle refusee", () => {
		expect(openRouterFailureOfStatus(402)).toBe('no-credit');
		expect(openRouterFailureOfStatus(401)).toBe('unavailable');
		expect(openRouterFailureOfStatus(500)).toBe('unreachable');
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
				source: 'openverse',
				previewUrl: 'https://api.openverse.org/v1/images/abc/thumb/',
				imageUrl: 'https://api.openverse.org/v1/images/abc/thumb/',
				title: 'Quiche',
				creator: 'mastermaq',
				license: 'BY-SA 2.0'
			},
			{
				id: 'def',
				source: 'openverse',
				previewUrl: 'https://source.example/other.jpg',
				imageUrl: 'https://source.example/other.jpg',
				title: '',
				creator: '',
				license: ''
			}
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
		const keys = (
			['offline', 'unavailable', 'unreachable', 'not-found', 'upload', 'no-key', 'no-credit'] as const
		).map(photoFailureKey);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
