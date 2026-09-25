import { describe, expect, it } from 'vitest';
import type { ImageSearchResult } from './ai-image';
import { bankResults, bankSearchRequest, interleave, isImageBank } from './image-bank';

describe('isImageBank', () => {
	it('ne connait que les banques qui acceptent qu on garde l image', () => {
		expect(isImageBank('pexels')).toBe(true);
		expect(isImageBank('pixabay')).toBe(true);
		expect(isImageBank('unsplash')).toBe(false);
	});
});

describe('bankSearchRequest', () => {
	it('passe la cle pexels en en-tete, jamais dans l adresse', () => {
		const request = bankSearchRequest('pexels', 'secret', 'quiche lorraine', 'fr');

		expect(request.url).toContain('https://api.pexels.com/v1/search?');
		expect(request.url).toContain('query=quiche+lorraine');
		expect(request.url).not.toContain('secret');
		expect(request.headers).toEqual({ Authorization: 'secret' });
	});

	it('passe la cle pixabay dans l adresse, comme son api l exige, et coupe une requete trop longue', () => {
		const request = bankSearchRequest('pixabay', 'secret', 'a'.repeat(150), 'de');
		const params = new URL(request.url).searchParams;

		expect(params.get('key')).toBe('secret');
		expect(params.get('q')).toHaveLength(100);
		expect(params.get('lang')).toBe('de');
		expect(params.get('safesearch')).toBe('true');
	});
});

describe('bankResults', () => {
	it('lit les photos pexels avec leur credit', () => {
		const payload = {
			photos: [
				{ id: 7, alt: ' Quiche ', photographer: 'Ana', src: { medium: 'https://p/m.jpg', large: 'https://p/l.jpg' } },
				{ id: 8 }
			]
		};

		expect(bankResults('pexels', payload)).toEqual([
			{
				id: 'pexels-7',
				source: 'pexels',
				previewUrl: 'https://p/m.jpg',
				imageUrl: 'https://p/l.jpg',
				title: 'Quiche',
				creator: 'Ana',
				license: 'Pexels'
			}
		]);
	});

	it('lit les images pixabay avec leur credit', () => {
		const payload = { hits: [{ id: 3, tags: 'quiche, tart', user: 'Bob', webformatURL: 'https://x/w.jpg' }] };

		expect(bankResults('pixabay', payload)).toEqual([
			{
				id: 'pixabay-3',
				source: 'pixabay',
				previewUrl: 'https://x/w.jpg',
				imageUrl: 'https://x/w.jpg',
				title: 'quiche, tart',
				creator: 'Bob',
				license: 'Pixabay'
			}
		]);
	});

	it('renvoie une liste vide sur une reponse illisible', () => {
		expect(bankResults('pexels', null)).toEqual([]);
		expect(bankResults('pixabay', { hits: 'nope' })).toEqual([]);
	});
});

describe('interleave', () => {
	const result = (id: string) => ({ id }) as ImageSearchResult;

	it('alterne les sources pour que chacune apparaisse des la premiere ligne', () => {
		const merged = interleave([[result('a1'), result('a2'), result('a3')], [result('b1')], []]);
		expect(merged.map((r) => r.id)).toEqual(['a1', 'b1', 'a2', 'a3']);
	});

	it('tient sans aucune source', () => {
		expect(interleave([])).toEqual([]);
	});
});
