import { supabase } from '$db/supabase';
import {
	afterRemoval,
	buildRequest,
	buildVisionRequest,
	DEFAULT_PROVIDER,
	isProvider,
	parseError,
	parseReply,
	providerById,
	resolveActiveCredential,
	withActive,
	activatesOnFirstSave,
	type AiCredentialRow,
	type ConversationTurn,
	type Provider,
	type ProviderRequest
} from '$domain/ai';
import {
	cleanImagePrompt,
	imagePromptRequest,
	parseRecipeSuggestion,
	type SuggestedRecipe
} from '$domain/ai-recipe';
import { parseChatReply, type ChatReply } from '$domain/ai-recipe-chat';
import {
	decodeDataUrl,
	openRouterFailureOfStatus,
	openRouterImageRequest,
	openRouterImageUrl,
	photoFailureOfStatus,
	recipePhotoPath,
	type PhotoFailure
} from '$domain/ai-image';

/**
 * The three outcomes of a request, told apart because they call for three different gestures: a network
 * failure is retried, a provider's refusal is read and fixed on their own account, and an unreadable answer
 * is asked for again.
 */
export type SuggestOutcome =
	| { ok: true; recipe: SuggestedRecipe }
	| { ok: false; reason: 'network' | 'provider' | 'unreadable' | 'unsupported'; detail: string };

type Failure = { ok: false; reason: 'network' | 'provider' | 'unreadable' | 'unsupported'; detail: string };

type TextOutcome = { ok: true; text: string } | Failure;

/** A chat turn's answer, with the provider's own text kept to be sent back as the history. */
export type ChatOutcome = { ok: true; reply: ChatReply; raw: string } | Failure;

export type PhotoOutcome = { ok: true; path: string } | { ok: false; reason: PhotoFailure };

/** One saved provider row, as the screen lists it. The key never leaves this shape. */
export type Credential = AiCredentialRow;

/**
 * The account's saved AI keys, and the one currently in charge of every call.
 *
 * Only two things leave this store towards the outside: the request built by `buildRequest`, and nothing
 * else. In particular a key never crosses the interface — the screens read `configured`, `provider`,
 * `model` and `credentials`, never a raw `apiKey`. `credentials` itself carries no key, for the same
 * reason: a component cannot show what is not there, and a report screenshot (#12) cannot take it away.
 *
 * There is no instance key in this application: with no key set here, there is no feature at all, and the
 * screens show nothing.
 */
class AiStore {
	/** Every saved row for this account, key omitted. What the profile screen lists. */
	credentials = $state<Credential[]>([]);

	/** While this is true, no screen concludes "no key": it concludes nothing. */
	loading = $state(true);

	error = $state<string | null>(null);

	/** Provider -> key, kept apart from `credentials` so the key never has to travel with the list. */
	#keys = new Map<string, string>();

	#active = $derived(resolveActiveCredential(this.credentials));

	get provider(): string {
		return this.#active?.provider ?? DEFAULT_PROVIDER;
	}

	get model(): string {
		return this.#active?.model ?? '';
	}

	/** A key is saved and active for this account. It is what the screens consult. */
	get configured(): boolean {
		return this.#active !== null;
	}

	/**
	 * Whether the active provider reads an image (#266). The "create a recipe by photo" entry point checks
	 * this before it ever shows its button, and `suggestRecipeFromPhoto` checks it again on its own so that a
	 * provider switched mid-screen cannot slip a photo through — see `Provider.supportsVision` for what this
	 * is and is not a promise about.
	 */
	/**
	 * Whether dish photos can be generated (#306): an OpenRouter key is saved, active or not. The image
	 * model is always OpenRouter's, whichever provider writes the recipes.
	 */
	get generatesImages(): boolean {
		return this.credentials.some((c) => c.provider === 'openrouter');
	}

	get supportsVision(): boolean {
		return this.#active ? (providerById(this.#active.provider)?.supportsVision ?? false) : false;
	}

	/**
	 * Reads the account's rows again. The account may hold none, one, or several — every provider it has
	 * saved a key for, at most one of them active.
	 */
	async load() {
		this.loading = true;
		this.error = null;

		const { data, error } = await supabase
			.from('ai_credentials')
			.select('provider, api_key, model, is_active')
			.order('provider');

		this.loading = false;

		if (error) {
			this.error = error.message;
			return;
		}

		this.#keys.clear();
		this.credentials = (data ?? [])
			.filter(row => isProvider(row.provider))
			.map(row => {
				this.#keys.set(row.provider, row.api_key);
				return { provider: row.provider, model: row.model, isActive: row.is_active };
			});
	}

	/**
	 * Saves a key for `provider`, replacing it if that provider was already saved. A first saved key
	 * becomes active on its own — there is otherwise nothing to switch to; a later one for an already
	 * represented provider keeps whatever activation state that row already had.
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

		const wasKnown = this.credentials.some(c => c.provider === provider);
		const isActive = wasKnown
			? (this.credentials.find(c => c.provider === provider)?.isActive ?? false)
			: activatesOnFirstSave(this.credentials);

		const { error } = await supabase.from('ai_credentials').upsert(
			{
				user_id: userId,
				provider,
				api_key: key,
				model: model.trim(),
				is_active: isActive,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'user_id,provider' }
		);

		if (error) {
			this.error = error.message;
			return false;
		}

		this.#keys.set(provider, key);
		const trimmedModel = model.trim();
		if (wasKnown) {
			this.credentials = this.credentials.map(c =>
				c.provider === provider ? { ...c, model: trimmedModel } : c
			);
		} else {
			this.credentials = [...this.credentials, { provider, model: trimmedModel, isActive }];
		}
		return true;
	}

	/**
	 * Removes the saved key for one provider. If that provider was the active one and exactly one other
	 * remains, that one becomes active on its own — there is nothing to choose between two options that do
	 * not exist. Otherwise (none left, or several candidates left) nobody is made active without the person
	 * saying which: a guess here would silently start billing a provider they did not pick.
	 */
	async clear(provider: string): Promise<boolean> {
		this.error = null;

		const { data: auth } = await supabase.auth.getUser();
		const userId = auth.user?.id;
		if (!userId) return false;

		const { error } = await supabase
			.from('ai_credentials')
			.delete()
			.eq('user_id', userId)
			.eq('provider', provider);

		if (error) {
			this.error = error.message;
			return false;
		}

		this.#keys.delete(provider);
		const { remaining, autoActivated } = afterRemoval(this.credentials, provider);

		if (autoActivated) {
			const activated = await this.#activateRow(userId, autoActivated);
			if (!activated) return false;
		}

		this.credentials = remaining;
		return true;
	}

	/**
	 * Switches which provider answers every call. Two plain updates rather than an RPC: the partial unique
	 * index (`ai_credentials_one_active`) is what actually guarantees "at most one active row", not the
	 * order of these two statements, so a stored procedure would buy no stronger a guarantee — only the
	 * same one with an extra round trip removed. Unsetting first and setting second, so a failure between
	 * the two leaves "nobody active" rather than briefly violating the index and getting rejected mid-flight.
	 */
	async setActive(provider: string): Promise<boolean> {
		if (!this.credentials.some(c => c.provider === provider)) return false;

		this.error = null;

		const { data: auth } = await supabase.auth.getUser();
		const userId = auth.user?.id;
		if (!userId) return false;

		const previouslyActive = this.#active?.provider;
		if (previouslyActive === provider) return true;

		if (previouslyActive) {
			const { error } = await supabase
				.from('ai_credentials')
				.update({ is_active: false })
				.eq('user_id', userId)
				.eq('provider', previouslyActive);
			if (error) {
				this.error = error.message;
				return false;
			}
		}

		const activated = await this.#activateRow(userId, provider);
		if (!activated) return false;

		this.credentials = withActive(this.credentials, provider);
		return true;
	}

	async #activateRow(userId: string, provider: string): Promise<boolean> {
		const { error } = await supabase
			.from('ai_credentials')
			.update({ is_active: true })
			.eq('user_id', userId)
			.eq('provider', provider);

		if (error) {
			this.error = error.message;
			return false;
		}
		return true;
	}

	/** The account has changed: what is left in memory belongs to somebody else. */
	reset() {
		this.#keys.clear();
		this.credentials = [];
		this.loading = true;
		this.error = null;
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
		return this.#ask(prompt);
	}

	/**
	 * One turn of the "ask the AI" chat (#313): `turns` is the whole history so far, oldest first, ending with
	 * the person's newest message, so that "and with tofu instead?" is understood against what was already
	 * discussed. The answer is either the complete recipe or one short question back (`ai-recipe-chat.ts`).
	 */
	async continueRecipeChat(turns: ConversationTurn[]): Promise<ChatOutcome> {
		const active = this.#active;
		const provider = active ? providerById(active.provider) : null;
		const apiKey = active ? this.#keys.get(active.provider) : undefined;
		if (!provider || !apiKey) {
			return { ok: false, reason: 'provider', detail: '' };
		}

		const request = buildRequest(provider, apiKey, active?.model ?? '', turns);
		const outcome = await this.#sendText(provider, request);
		if (!outcome.ok) return outcome;

		const reply = parseChatReply(outcome.text);
		if (reply === null) return { ok: false, reason: 'unreadable', detail: '' };

		return { ok: true, reply, raw: outcome.text };
	}

	/**
	 * Reads a photo of a book page or a written/printed recipe (#266) and turns it into the same suggestion
	 * shape every other entry point produces, so the review screen (`RecipeSuggestionCard`) does not need to
	 * know where the recipe came from.
	 *
	 * Declined with `{ reason: 'unsupported' }`, before anything leaves the browser, when the active provider
	 * cannot read an image — the caller is expected to point the person at Profil -> IA rather than let the
	 * provider fail on its own terms.
	 */
	async suggestRecipeFromPhoto(
		imageBase64: string,
		mimeType: string,
		prompt: string
	): Promise<SuggestOutcome> {
		const active = this.#active;
		const provider = active ? providerById(active.provider) : null;
		const apiKey = active ? this.#keys.get(active.provider) : undefined;
		if (!provider || !apiKey) {
			return { ok: false, reason: 'provider', detail: '' };
		}
		if (!provider.supportsVision) {
			return { ok: false, reason: 'unsupported', detail: '' };
		}

		const request = buildVisionRequest(
			provider,
			apiKey,
			active?.model ?? '',
			prompt,
			imageBase64,
			mimeType
		);

		return this.#send(provider, request);
	}

	async #ask(promptOrTurns: string | ConversationTurn[]): Promise<SuggestOutcome> {
		const active = this.#active;
		const provider = active ? providerById(active.provider) : null;
		const apiKey = active ? this.#keys.get(active.provider) : undefined;
		if (!provider || !apiKey) {
			return { ok: false, reason: 'provider', detail: '' };
		}

		const request = buildRequest(provider, apiKey, active?.model ?? '', promptOrTurns);

		return this.#send(provider, request);
	}

	async #send(provider: Provider, request: ProviderRequest): Promise<SuggestOutcome> {
		const outcome = await this.#sendText(provider, request);
		if (!outcome.ok) return outcome;

		const recipe = parseRecipeSuggestion(outcome.text);
		if (recipe === null) return { ok: false, reason: 'unreadable', detail: '' };

		return { ok: true, recipe };
	}

	async #sendText(provider: Provider, request: ProviderRequest): Promise<TextOutcome> {
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

		return { ok: true, text };
	}

	/**
	 * Asks the active provider for the English description a dish photo is drawn from, for a recipe no AI
	 * wrote (#306). Null when no provider is set or its answer is unusable: the caller falls back to the
	 * template built from the name and ingredients.
	 */
	async describeDish(recipeName: string, ingredientNames: string[], steps: string[]): Promise<string | null> {
		const active = this.#active;
		const provider = active ? providerById(active.provider) : null;
		const apiKey = active ? this.#keys.get(active.provider) : undefined;
		if (!provider || !apiKey) return null;

		const request = buildRequest(
			provider,
			apiKey,
			active?.model ?? '',
			imagePromptRequest(recipeName, ingredientNames, steps)
		);

		try {
			const response = await fetch(request.url, {
				method: 'POST',
				headers: request.headers,
				body: request.body
			});
			if (!response.ok) return null;

			const text = parseReply(provider, await response.json());
			return text === null ? null : cleanImagePrompt(text);
		} catch {
			return null;
		}
	}

	/**
	 * Generates a dish photo with the person's own OpenRouter key and uploads it to the household's
	 * `recipe-photos` bucket.
	 *
	 * The image never blocks saving a recipe (#186), but a failure is never silent (#303): the reason comes
	 * back so the screen can say what happened and what to do about it.
	 */
	async generateRecipePhoto(
		householdId: string,
		recipeId: string,
		prompt: string,
		seed = Math.floor(Math.random() * 2 ** 31)
	): Promise<PhotoOutcome> {
		const apiKey = this.#keys.get('openrouter');
		if (!apiKey) return { ok: false, reason: 'no-key' };

		const request = openRouterImageRequest(apiKey, prompt, seed);

		let response: Response;
		try {
			response = await fetch(request.url, {
				method: 'POST',
				headers: request.headers,
				body: request.body
			});
		} catch {
			return { ok: false, reason: networkFailure() };
		}

		if (!response.ok) return { ok: false, reason: openRouterFailureOfStatus(response.status) };

		const url = openRouterImageUrl(await response.json().catch(() => null));
		const image = url ? decodeDataUrl(url) : null;
		if (!image) return { ok: false, reason: 'unreachable' };

		return this.#uploadPhoto(householdId, recipeId, image.bytes, image.mimeType);
	}

	/**
	 * Fetches a photo published at a URL — a generated one, a picked search result, an imported recipe's own
	 * picture (#236) — and uploads it to the household's `recipe-photos` bucket. Every source converges here,
	 * so a stored photo is the same thing afterwards whatever it came from.
	 */
	async fetchRecipePhoto(
		householdId: string,
		recipeId: string,
		imageUrl: string
	): Promise<PhotoOutcome> {
		let response: Response;
		try {
			response = await fetch(imageUrl);
		} catch {
			return { ok: false, reason: networkFailure() };
		}

		if (!response.ok) return { ok: false, reason: photoFailureOfStatus(response.status) };

		let bytes: Uint8Array;
		try {
			bytes = new Uint8Array(await response.arrayBuffer());
		} catch {
			return { ok: false, reason: networkFailure() };
		}

		const mimeType = response.headers.get('content-type') ?? 'image/jpeg';
		if (!mimeType.startsWith('image/')) return { ok: false, reason: 'unreachable' };

		return this.#uploadPhoto(householdId, recipeId, bytes, mimeType);
	}

	/** A photo the person took or picked on the device, already resized by the caller. */
	async uploadRecipePhoto(householdId: string, recipeId: string, photo: Blob): Promise<PhotoOutcome> {
		let bytes: Uint8Array;
		try {
			bytes = new Uint8Array(await photo.arrayBuffer());
		} catch {
			return { ok: false, reason: 'upload' };
		}
		return this.#uploadPhoto(householdId, recipeId, bytes, photo.type || 'image/jpeg');
	}

	async removeRecipePhoto(photoPath: string): Promise<void> {
		await supabase.storage.from('recipe-photos').remove([photoPath]);
	}

	async #uploadPhoto(
		householdId: string,
		recipeId: string,
		bytes: Uint8Array,
		mimeType: string
	): Promise<PhotoOutcome> {
		const path = recipePhotoPath(householdId, recipeId, mimeType);

		const { error } = await supabase.storage
			.from('recipe-photos')
			.upload(path, bytes, { contentType: mimeType, upsert: true });

		if (error) return { ok: false, reason: 'upload' };

		return { ok: true, path };
	}
}

function networkFailure(): PhotoFailure {
	return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unreachable';
}

export const ai = new AiStore();
