import { supabase } from '$db/supabase';
import {
	buildRequest,
	DEFAULT_PROVIDER,
	isProvider,
	parseError,
	parseReply,
	providerById
} from '$domain/ai';
import { parseRecipeSuggestion, type SuggestedRecipe } from '$domain/ai-recipe';

/**
 * The three outcomes of a request, told apart because they call for three different gestures: a network
 * failure is retried, a provider's refusal is read and fixed on their own account, and an unreadable answer
 * is asked for again.
 */
export type SuggestOutcome =
	| { ok: true; recipe: SuggestedRecipe }
	| { ok: false; reason: 'network' | 'provider' | 'unreadable'; detail: string };

/**
 * The API key the person has set, and the call it allows.
 *
 * Only two things leave this store towards the outside: the request built by `buildRequest`, and nothing
 * else. In particular the key never crosses the interface — the screens read `configured`, `provider` and
 * `model`, never `#apiKey`. That is the reason for the private field: a component cannot show it by
 * distraction, and a report screenshot (#12) cannot take it away.
 *
 * There is no instance key in this application: with no key set here, there is no feature at all, and the
 * screens show nothing.
 */
class AiStore {
	provider = $state<string>(DEFAULT_PROVIDER);
	model = $state('');

	/** A key is saved for this account. It is what the screens consult. */
	configured = $state(false);

	/** While this is true, no screen concludes "no key": it concludes nothing. */
	loading = $state(true);

	error = $state<string | null>(null);

	#apiKey = '';

	/**
	 * Reads the account's row again. `maybeSingle` and not `single`: the absence of a key is the normal case
	 * on the first pass, and `single` would turn it into an error shown to somebody who asked for nothing.
	 */
	async load() {
		this.loading = true;
		this.error = null;

		const { data, error } = await supabase
			.from('ai_credentials')
			.select('provider, api_key, model')
			.maybeSingle();

		this.loading = false;

		if (error) {
			this.error = error.message;
			return;
		}

		if (!data) {
			this.#apiKey = '';
			this.configured = false;
			return;
		}

		this.provider = isProvider(data.provider) ? data.provider : DEFAULT_PROVIDER;
		this.model = data.model;
		this.#apiKey = data.api_key;
		this.configured = true;
	}

	/**
	 * Saves the signed-in account's key.
	 *
	 * `user_id` is set explicitly rather than left to a default: the policy compares it to `auth.uid()`, and a
	 * missing column would make the write fail on an RLS violation rather than on an understandable message.
	 */
	async save(provider: string, apiKey: string, model: string): Promise<boolean> {
		const key = apiKey.trim();
		if (!isProvider(provider) || key === '') return false;

		this.error = null;

		const { data: auth } = await supabase.auth.getUser();
		const userId = auth.user?.id;
		if (!userId) {
			this.error = 'no-session';
			return false;
		}

		const { error } = await supabase.from('ai_credentials').upsert(
			{
				user_id: userId,
				provider,
				api_key: key,
				model: model.trim(),
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'user_id' }
		);

		if (error) {
			this.error = error.message;
			return false;
		}

		this.provider = provider;
		this.model = model.trim();
		this.#apiKey = key;
		this.configured = true;
		return true;
	}

	async clear(): Promise<boolean> {
		this.error = null;

		const { data: auth } = await supabase.auth.getUser();
		const userId = auth.user?.id;
		if (!userId) return false;

		const { error } = await supabase.from('ai_credentials').delete().eq('user_id', userId);

		if (error) {
			this.error = error.message;
			return false;
		}

		this.#apiKey = '';
		this.model = '';
		this.configured = false;
		return true;
	}

	/** The account has changed: what is left in memory belongs to somebody else. */
	reset() {
		this.#apiKey = '';
		this.model = '';
		this.provider = DEFAULT_PROVIDER;
		this.configured = false;
		this.loading = true;
	}

	/**
	 * The only call that leaves the browser straight for a third party.
	 *
	 * Importing a recipe from a link (#140) also leaves the project, but it goes through the instance's
	 * server, which presents itself to the site visited. Here there is no intermediary: the request leaves the
	 * device, and that is why the provider must accept a browser origin — a condition that on its own decides
	 * the `PROVIDERS` list.
	 *
	 * It leaves the browser, with the person's key: it is their quota and their bill. The text sent is exactly
	 * `prompt`, the one the screen has just shown — no context header added here, without which what is shown
	 * before sending would stop being what leaves.
	 */
	async suggestRecipe(prompt: string): Promise<SuggestOutcome> {
		const provider = providerById(this.provider);
		if (!provider || !this.#apiKey) {
			return { ok: false, reason: 'provider', detail: '' };
		}

		const request = buildRequest(provider, this.#apiKey, this.model, prompt);

		let response: Response;
		try {
			response = await fetch(request.url, {
				method: 'POST',
				headers: request.headers,
				body: request.body
			});
		} catch {
			// A CORS refusal arrives here, indistinguishable from a network outage: the browser says nothing more to
			// the calling code, by design.
			return { ok: false, reason: 'network', detail: '' };
		}

		const payload: unknown = await response.json().catch(() => null);

		if (!response.ok) {
			return {
				ok: false,
				reason: 'provider',
				detail: parseError(payload) ?? String(response.status)
			};
		}

		const text = parseReply(provider, payload);
		if (text === null) return { ok: false, reason: 'unreadable', detail: '' };

		const recipe = parseRecipeSuggestion(text);
		if (recipe === null) return { ok: false, reason: 'unreadable', detail: '' };

		return { ok: true, recipe };
	}
}

export const ai = new AiStore();
