import { supabase } from '$db/supabase';
import { isPlaceProvider, type PlaceProviderId } from '$domain/place-bank';

/** A Google Places key, brought by whoever wants it — same shape as `image-banks.svelte.ts`. */
class PlaceCredentials {
	saved = $state<PlaceProviderId[]>([]);
	loading = $state(true);
	error = $state<string | null>(null);

	#keys = new Map<PlaceProviderId, string>();

	async load() {
		this.loading = true;
		this.error = null;

		const { data, error } = await supabase
			.from('place_credentials')
			.select('provider, api_key')
			.order('provider');

		this.loading = false;

		if (error) {
			this.error = error.message;
			return;
		}

		this.#keys.clear();
		for (const row of data ?? []) {
			if (isPlaceProvider(row.provider)) this.#keys.set(row.provider, row.api_key);
		}
		this.saved = [...this.#keys.keys()];
	}

	key(provider: PlaceProviderId): string | undefined {
		return this.#keys.get(provider);
	}

	async save(provider: PlaceProviderId, apiKey: string): Promise<boolean> {
		const key = apiKey.trim();
		if (!key) return false;

		this.error = null;
		const { data: auth } = await supabase.auth.getUser();
		const userId = auth.user?.id;
		if (!userId) {
			this.error = 'no-session';
			return false;
		}

		const { error } = await supabase.from('place_credentials').upsert(
			{ user_id: userId, provider, api_key: key, updated_at: new Date().toISOString() },
			{ onConflict: 'user_id,provider' }
		);

		if (error) {
			this.error = error.message;
			return false;
		}

		this.#keys.set(provider, key);
		this.saved = [...this.#keys.keys()];
		return true;
	}

	async clear(provider: PlaceProviderId): Promise<boolean> {
		this.error = null;
		const { data: auth } = await supabase.auth.getUser();
		const userId = auth.user?.id;
		if (!userId) return false;

		const { error } = await supabase
			.from('place_credentials')
			.delete()
			.eq('user_id', userId)
			.eq('provider', provider);

		if (error) {
			this.error = error.message;
			return false;
		}

		this.#keys.delete(provider);
		this.saved = [...this.#keys.keys()];
		return true;
	}
}

export const placeCredentials = new PlaceCredentials();
