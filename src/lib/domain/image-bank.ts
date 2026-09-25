import type { ImageSearchResult } from './ai-image';

export const IMAGE_BANKS = [
	{ id: 'pexels', name: 'Pexels', keyUrl: 'https://www.pexels.com/api/new/' },
	{ id: 'pixabay', name: 'Pixabay', keyUrl: 'https://pixabay.com/api/docs/' }
] as const;

export type ImageBankId = (typeof IMAGE_BANKS)[number]['id'];

export const BANK_PAGE_SIZE = 20;

/** Pixabay rejects a query longer than 100 characters. */
const PIXABAY_QUERY_LIMIT = 100;

export function isImageBank(id: string): id is ImageBankId {
	return IMAGE_BANKS.some((bank) => bank.id === id);
}

export interface BankRequest {
	url: string;
	headers: Record<string, string>;
}

export function bankSearchRequest(bank: ImageBankId, apiKey: string, query: string, locale: string): BankRequest {
	if (bank === 'pexels') {
		const params = new URLSearchParams({ query, per_page: String(BANK_PAGE_SIZE) });
		return { url: `https://api.pexels.com/v1/search?${params.toString()}`, headers: { Authorization: apiKey } };
	}

	const params = new URLSearchParams({
		key: apiKey,
		q: query.slice(0, PIXABAY_QUERY_LIMIT),
		image_type: 'photo',
		safesearch: 'true',
		per_page: String(BANK_PAGE_SIZE),
		lang: locale
	});
	return { url: `https://pixabay.com/api/?${params.toString()}`, headers: {} };
}

interface PexelsPhoto {
	id?: number;
	alt?: string;
	photographer?: string;
	src?: { medium?: string; large?: string };
}

interface PixabayHit {
	id?: number;
	tags?: string;
	user?: string;
	webformatURL?: string;
	largeImageURL?: string;
}

export function bankResults(bank: ImageBankId, payload: unknown): ImageSearchResult[] {
	if (bank === 'pexels') {
		const photos = (payload as { photos?: PexelsPhoto[] } | null)?.photos;
		if (!Array.isArray(photos)) return [];

		return photos.flatMap((photo) => {
			const previewUrl = photo?.src?.medium;
			if (photo?.id === undefined || !previewUrl) return [];
			return [
				{
					id: `pexels-${photo.id}`,
					source: 'pexels',
					previewUrl,
					imageUrl: photo.src?.large ?? previewUrl,
					title: photo.alt?.trim() ?? '',
					creator: photo.photographer?.trim() ?? '',
					license: 'Pexels'
				}
			];
		});
	}

	const hits = (payload as { hits?: PixabayHit[] } | null)?.hits;
	if (!Array.isArray(hits)) return [];

	return hits.flatMap((hit) => {
		const previewUrl = hit?.webformatURL;
		if (hit?.id === undefined || !previewUrl) return [];
		return [
			{
				id: `pixabay-${hit.id}`,
				source: 'pixabay',
				previewUrl,
				imageUrl: hit.largeImageURL ?? previewUrl,
				title: hit.tags?.trim() ?? '',
				creator: hit.user?.trim() ?? '',
				license: 'Pixabay'
			}
		];
	});
}

/** One result from each source in turn, so the first rows already show every bank the person set up. */
export function interleave(lists: ImageSearchResult[][]): ImageSearchResult[] {
	const merged: ImageSearchResult[] = [];
	const longest = Math.max(0, ...lists.map((list) => list.length));
	for (let index = 0; index < longest; index++) {
		for (const list of lists) {
			const result = list[index];
			if (result) merged.push(result);
		}
	}
	return merged;
}
