/**
 * The artificial intelligence providers callable from a browser.
 *
 * This whole application is a static page: there is no server of ours, and no key is set by the host. The
 * call therefore leaves from the person's browser, with their own key. That restricts the list far more than
 * the market's catalogue would suggest, and it is the only reason some expected names are missing here.
 *
 * What was checked, provider by provider, by sending a real request with an `Origin` header: the `OPTIONS`
 * preflight passes, **and** the `POST` response also carries `access-control-allow-origin`. Both are needed
 * — a browser that gets the preflight but reads a response with no header throws the result away all the
 * same, and the calling code only receives a network failure with no explanation.
 *
 * OpenAI fails precisely the second condition and is therefore not offered. Its preflight answers
 * `access-control-allow-origin`, but the `POST` response does not: from a page, the request leaves and the
 * result is unreachable. The official SDK's `dangerouslyAllowBrowser` changes nothing about that — that
 * option lifts a guardrail of the SDK, not the browser's rule. Offering it in the list would give a box to
 * tick that cannot work, which is worse than its absence.
 *
 * No key travels in an address. Gemini accepts its own as a query parameter (`?key=`), and that is the form
 * its documentation shows; we use the `x-goog-api-key` header, which it accepts just as well. An address
 * ends up in the logs of the servers crossed, in the browser history and in the referrer header of the next
 * request — three places where a billing key has no business.
 */

/** The request shapes. Four providers out of six speak OpenAI's dialect. */
type Dialect = 'openai' | 'anthropic' | 'gemini';

export interface Provider {
	id: string;
	dialect: Dialect;
	/** API root, with no trailing slash. */
	base: string;
	/** The model called when the person has not chosen another. */
	defaultModel: string;
	/** Where the person goes to get their key. Shown as it is, never translated. */
	keysUrl: string;
	/**
	 * Whether the *default model* of this provider reads an image. This is a statement about the model named
	 * in `defaultModel`, not about the provider's whole catalogue — someone who typed a different model in
	 * the profile screen may have picked one with different capabilities either way, and there is no
	 * reachable, key-free endpoint that would tell us which. Anthropic's and Gemini's default models both
	 * read images natively. OpenRouter proxies many catalogues under one dialect, and its own default model
	 * also reads images. Mistral, Groq and DeepSeek's default models here are text-only, so the photo feature
	 * is declined for them rather than sent and left to fail on their side.
	 */
	supportsVision: boolean;
}

export const PROVIDERS: Provider[] = [
	{
		id: 'anthropic',
		dialect: 'anthropic',
		base: 'https://api.anthropic.com/v1',
		defaultModel: 'claude-3-5-haiku-latest',
		keysUrl: 'https://console.anthropic.com/settings/keys',
		supportsVision: true
	},
	{
		id: 'gemini',
		dialect: 'gemini',
		base: 'https://generativelanguage.googleapis.com/v1beta',
		defaultModel: 'gemini-3.6-flash',
		keysUrl: 'https://aistudio.google.com/apikey',
		supportsVision: true
	},
	{
		id: 'mistral',
		dialect: 'openai',
		base: 'https://api.mistral.ai/v1',
		defaultModel: 'mistral-small-latest',
		keysUrl: 'https://console.mistral.ai/api-keys',
		supportsVision: false
	},
	{
		id: 'groq',
		dialect: 'openai',
		base: 'https://api.groq.com/openai/v1',
		defaultModel: 'llama-3.3-70b-versatile',
		keysUrl: 'https://console.groq.com/keys',
		supportsVision: false
	},
	{
		id: 'openrouter',
		dialect: 'openai',
		base: 'https://openrouter.ai/api/v1',
		defaultModel: 'meta-llama/llama-3.3-70b-instruct',
		keysUrl: 'https://openrouter.ai/settings/keys',
		supportsVision: false
	},
	{
		id: 'deepseek',
		dialect: 'openai',
		base: 'https://api.deepseek.com',
		defaultModel: 'deepseek-chat',
		keysUrl: 'https://platform.deepseek.com/api_keys',
		supportsVision: false
	}
];

export const DEFAULT_PROVIDER = 'anthropic';

export const providerById = (id: string): Provider | null =>
	PROVIDERS.find(p => p.id === id) ?? null;

export const isProvider = (value: unknown): value is string =>
	typeof value === 'string' && PROVIDERS.some(p => p.id === value);

/**
 * One saved provider row, key omitted: this shape is what the store keeps for resolving "which one is
 * active" and what the profile screen lists — never the key itself, which stays in the store's own map.
 */
export interface AiCredentialRow {
	provider: string;
	model: string;
	isActive: boolean;
}

/**
 * The row currently in charge of every call, or null if none is. Pulled out as its own function because
 * the partial unique index only guarantees at most one active row server-side — the client still has to
 * find it in whatever `load()` returned, and every getter the screens read (`provider`, `model`,
 * `configured`) goes through this same lookup.
 */
export function resolveActiveCredential(credentials: AiCredentialRow[]): AiCredentialRow | null {
	return credentials.find(c => c.isActive) ?? null;
}

/**
 * What the list becomes once `provider`'s row is gone.
 *
 * Removing the active row when exactly one other remains activates it on its own: there is nothing to
 * choose between two options that do not exist, so asking would only interrupt for no real decision.
 * Removing it when several remain, or when none do, leaves the list with nobody active — a guess between
 * several candidates would silently start billing a provider the person did not pick, which is worse than
 * a screen that asks them to choose.
 */
export function afterRemoval(
	credentials: AiCredentialRow[],
	provider: string
): { remaining: AiCredentialRow[]; autoActivated: string | null } {
	const removed = credentials.find(c => c.provider === provider);
	const remaining = credentials.filter(c => c.provider !== provider);

	if (removed?.isActive && remaining.length === 1) {
		const [only] = remaining;
		return { remaining: [{ ...only, isActive: true }], autoActivated: only.provider };
	}

	return { remaining, autoActivated: null };
}

/** The list with exactly `provider`'s row active and every other one not, for an optimistic local update. */
export function withActive(credentials: AiCredentialRow[], provider: string): AiCredentialRow[] {
	return credentials.map(c => ({ ...c, isActive: c.provider === provider }));
}

/**
 * Whether a freshly saved row for `provider` should start active: the first row an account ever saves has
 * nothing to compete with, so it becomes active on its own. A later provider joining an already non-empty
 * list starts inactive — switching to it is a deliberate choice made from the list, not a side effect of
 * typing a second key.
 */
export function activatesOnFirstSave(credentials: AiCredentialRow[]): boolean {
	return credentials.length === 0;
}

/** The model actually called: the one chosen, otherwise the provider's. */
export function modelFor(provider: Provider, chosen: string): string {
	return chosen.trim() || provider.defaultModel;
}

export interface ProviderRequest {
	url: string;
	headers: Record<string, string>;
	body: string;
}

/** One exchange in a conversation, in the order it happened. */
export interface ConversationTurn {
	role: 'user' | 'assistant';
	content: string;
}

/** A single prompt is a conversation of exactly one turn. */
const toTurns = (promptOrTurns: string | ConversationTurn[]): ConversationTurn[] =>
	typeof promptOrTurns === 'string' ? [{ role: 'user', content: promptOrTurns }] : promptOrTurns;

/**
 * The request to send, in a shape `fetch` takes as it is.
 *
 * A pure function, and that is intended: this is where the key is put in a header rather than in an address,
 * and it is the only thing in this whole file a test can check with no network.
 *
 * `promptOrTurns` accepts either a single string, for a one-shot request, or the full history of a
 * conversation so far (oldest first) — each provider's real API already supports sending prior turns back
 * so that it keeps the context, so this is a straight passthrough to their native shape rather than a
 * home-grown one: `messages: [{role, content}, ...]` for the OpenAI/Anthropic-shaped dialects, and
 * `contents: [{role, parts}, ...]` for Gemini, whose dialect names the assistant's role `model`.
 */
export function buildRequest(
	provider: Provider,
	apiKey: string,
	model: string,
	promptOrTurns: string | ConversationTurn[]
): ProviderRequest {
	const name = modelFor(provider, model);
	const turns = toTurns(promptOrTurns);

	if (provider.dialect === 'anthropic') {
		return {
			url: `${provider.base}/messages`,
			headers: {
				'content-type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01',
				// Without this header, both the SDK and the API refuse a request coming from a page. It amounts to an
				// acknowledgement of the risk: the key is in the browser, it belongs to the person who set it, and that
				// is precisely the choice this feature makes.
				'anthropic-dangerous-direct-browser-access': 'true'
			},
			body: JSON.stringify({
				model: name,
				max_tokens: MAX_TOKENS,
				messages: turns.map(turn => ({ role: turn.role, content: turn.content }))
			})
		};
	}

	if (provider.dialect === 'gemini') {
		return {
			url: `${provider.base}/models/${name}:generateContent`,
			headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
			body: JSON.stringify({
				contents: turns.map(turn => ({
					role: turn.role === 'assistant' ? 'model' : 'user',
					parts: [{ text: turn.content }]
				}))
			})
		};
	}

	return {
		url: `${provider.base}/chat/completions`,
		headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
		body: JSON.stringify({
			model: name,
			max_tokens: MAX_TOKENS,
			messages: turns.map(turn => ({ role: turn.role, content: turn.content }))
		})
	};
}

/**
 * The request to send an image alongside a prompt, in whichever multimodal shape the provider's dialect
 * expects — three different shapes for three dialects, none of them the same as `buildRequest`'s text-only
 * body:
 *  - anthropic: a `content` array mixing an `image` block (base64 `source`) and a `text` block;
 *  - gemini: a `parts` array mixing `inlineData` (base64) and `text`;
 *  - the openai dialect: a `content` array mixing `image_url` (a `data:` URI) and `text`.
 *
 * Only called for a provider whose `supportsVision` is true — callers must check that first, this function
 * does not refuse on their behalf.
 */
export function buildVisionRequest(
	provider: Provider,
	apiKey: string,
	model: string,
	prompt: string,
	imageBase64: string,
	mimeType: string
): ProviderRequest {
	const name = modelFor(provider, model);

	if (provider.dialect === 'anthropic') {
		return {
			url: `${provider.base}/messages`,
			headers: {
				'content-type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01',
				'anthropic-dangerous-direct-browser-access': 'true'
			},
			body: JSON.stringify({
				model: name,
				max_tokens: MAX_TOKENS,
				messages: [
					{
						role: 'user',
						content: [
							{
								type: 'image',
								source: { type: 'base64', media_type: mimeType, data: imageBase64 }
							},
							{ type: 'text', text: prompt }
						]
					}
				]
			})
		};
	}

	if (provider.dialect === 'gemini') {
		return {
			url: `${provider.base}/models/${name}:generateContent`,
			headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
			body: JSON.stringify({
				contents: [
					{
						role: 'user',
						parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }]
					}
				]
			})
		};
	}

	return {
		url: `${provider.base}/chat/completions`,
		headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
		body: JSON.stringify({
			model: name,
			max_tokens: MAX_TOKENS,
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
						{ type: 'text', text: prompt }
					]
				}
			]
		})
	};
}

/** Enough to write a complete recipe, and no more: we are not paying for an essay. */
const MAX_TOKENS = 1200;

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const firstOf = (value: unknown): unknown => (Array.isArray(value) ? value[0] : undefined);

/**
 * The text returned by the provider, or null if the response does not have the expected shape.
 *
 * We go down field by field rather than chaining question marks: an error response has the same envelope as
 * a valid one at several providers, and an unguarded optional access would return `undefined` where
 * "nothing to read" has to be told from "empty string".
 */
export function parseReply(provider: Provider, payload: unknown): string | null {
	const root = asRecord(payload);
	if (!root) return null;

	if (provider.dialect === 'anthropic') {
		const block = asRecord(firstOf(root.content));
		return typeof block?.text === 'string' ? block.text : null;
	}

	if (provider.dialect === 'gemini') {
		const candidate = asRecord(firstOf(root.candidates));
		const content = asRecord(candidate?.content);
		const part = asRecord(firstOf(content?.parts));
		return typeof part?.text === 'string' ? part.text : null;
	}

	const choice = asRecord(firstOf(root.choices));
	const message = asRecord(choice?.message);
	return typeof message?.content === 'string' ? message.content : null;
}

/**
 * What the provider objects to, in one sentence, or null if it says nothing usable.
 *
 * The six do not write their errors in the same place: `error.message` at most of them, `detail` at Mistral.
 * Returning the provider's message rather than a text of ours is the right choice here — "credit exhausted"
 * and "unknown model" call for two different gestures, and only the person who owns the account can act on
 * either.
 */
export function parseError(payload: unknown): string | null {
	const root = asRecord(payload);
	if (!root) return null;

	const error = asRecord(root.error);
	if (typeof error?.message === 'string' && error.message) return error.message;
	if (typeof root.detail === 'string' && root.detail) return root.detail;
	if (typeof root.message === 'string' && root.message) return root.message;

	return null;
}
