import { supabase } from '$db/supabase';
import { i18n } from '$i18n/index.svelte';
import {
	imageSearchResults,
	openverseSearchUrl,
	photoFailureOfStatus,
	type ImageSearchResult,
	type PhotoFailure
} from '$domain/ai-image';
import { bankResults, bankSearchRequest, interleave, isImageBank, type ImageBankId } from '$domain/image-bank';

export type PhotoSearchOutcome =
	| { ok: true; results: ImageSearchResult[] }
	| { ok: false; reason: PhotoFailure };

type SourceOutcome = { ok: true; results: ImageSearchResult[] } | { ok: false; reason: PhotoFailure };

class ImageBanks {
	/** Banks this account saved a key for. The keys themselves never leave `#keys`. */
	saved = $state<ImageBankId[]>([]);
	loading = $state(true);
	error = $state<string | null>(null);

	#keys = new Map<ImageBankId, string>();

	async load() {
		this.loading = true;
		this.error = null;

		const { data, error } = await supabase
			.from('image_bank_credentials')
			.select('provider, api_key')
			.order('provider');

		this.loading = false;

		if (error) {
			this.error = error.message;
			return;
		}

		this.#keys.clear();
		for (const row of data ?? []) {
			if (isImageBank(row.provider)) this.#keys.set(row.provider, row.api_key);
		}
		this.saved = [...this.#keys.keys()];
	}

	async save(bank: ImageBankId, apiKey: string): Promise<boolean> {
		const key = apiKey.trim();
		if (!key) return false;

		this.error = null;
		const { data: auth } = await supabase.auth.getUser();
		const userId = auth.user?.id;
		if (!userId) {
			this.error = 'no-session';
			return false;
		}

		const { error } = await supabase.from('image_bank_credentials').upsert(
			{ user_id: userId, provider: bank, api_key: key, updated_at: new Date().toISOString() },
			{ onConflict: 'user_id,provider' }
		);

		if (error) {
			this.error = error.message;
			return false;
		}

		this.#keys.set(bank, key);
		this.saved = [...this.#keys.keys()];
		return true;
	}

	async clear(bank: ImageBankId): Promise<boolean> {
		this.error = null;
		const { data: auth } = await supabase.auth.getUser();
		const userId = auth.user?.id;
		if (!userId) return false;

		const { error } = await supabase
			.from('image_bank_credentials')
			.delete()
			.eq('user_id', userId)
			.eq('provider', bank);

		if (error) {
			this.error = error.message;
			return false;
		}

		this.#keys.delete(bank);
		this.saved = [...this.#keys.keys()];
		return true;
	}

	/**
	 * Openverse always, plus every bank this account holds a key for, all at once. One source failing does
	 * not hide what the others found; only when every source fails does the reason reach the screen.
	 */
	async search(query: string): Promise<PhotoSearchOutcome> {
		const sources = [
			searchSource(openverseSearchUrl(query), {}, imageSearchResults),
			...[...this.#keys].map(([bank, key]) => {
				const request = bankSearchRequest(bank, key, query, i18n.locale);
				return searchSource(request.url, request.headers, (payload) => bankResults(bank, payload));
			})
		];

		const outcomes = await Promise.all(sources);
		const found = outcomes.flatMap((outcome) => (outcome.ok ? [outcome.results] : []));
		const results = interleave(found);
		if (results.length) return { ok: true, results };

		const failure = outcomes.find((outcome): outcome is { ok: false; reason: PhotoFailure } => !outcome.ok);
		return { ok: false, reason: found.length || !failure ? 'not-found' : failure.reason };
	}
}

async function searchSource(
	url: string,
	headers: Record<string, string>,
	parse: (payload: unknown) => ImageSearchResult[]
): Promise<SourceOutcome> {
	let response: Response;
	try {
		response = await fetch(url, { headers });
	} catch {
		return { ok: false, reason: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unreachable' };
	}

	if (!response.ok) return { ok: false, reason: photoFailureOfStatus(response.status) };

	const payload: unknown = await response.json().catch(() => null);
	return { ok: true, results: parse(payload) };
}

export const imageBanks = new ImageBanks();
