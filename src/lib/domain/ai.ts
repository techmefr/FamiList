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
}

export const PROVIDERS: Provider[] = [
	{
		id: 'anthropic',
		dialect: 'anthropic',
		base: 'https://api.anthropic.com/v1',
		defaultModel: 'claude-3-5-haiku-latest',
		keysUrl: 'https://console.anthropic.com/settings/keys'
	},
	{
		id: 'gemini',
		dialect: 'gemini',
		base: 'https://generativelanguage.googleapis.com/v1beta',
		defaultModel: 'gemini-3.6-flash',
		keysUrl: 'https://aistudio.google.com/apikey'
	},
	{
		id: 'mistral',
		dialect: 'openai',
		base: 'https://api.mistral.ai/v1',
		defaultModel: 'mistral-small-latest',
		keysUrl: 'https://console.mistral.ai/api-keys'
	},
	{
		id: 'groq',
		dialect: 'openai',
		base: 'https://api.groq.com/openai/v1',
		defaultModel: 'llama-3.3-70b-versatile',
		keysUrl: 'https://console.groq.com/keys'
	},
	{
		id: 'openrouter',
		dialect: 'openai',
		base: 'https://openrouter.ai/api/v1',
		defaultModel: 'meta-llama/llama-3.3-70b-instruct',
		keysUrl: 'https://openrouter.ai/settings/keys'
	},
	{
		id: 'deepseek',
		dialect: 'openai',
		base: 'https://api.deepseek.com',
		defaultModel: 'deepseek-chat',
		keysUrl: 'https://platform.deepseek.com/api_keys'
	}
];

export const DEFAULT_PROVIDER = 'anthropic';

export const providerById = (id: string): Provider | null =>
	PROVIDERS.find(p => p.id === id) ?? null;

export const isProvider = (value: unknown): value is string =>
	typeof value === 'string' && PROVIDERS.some(p => p.id === value);

/** The model actually called: the one chosen, otherwise the provider's. */
export function modelFor(provider: Provider, chosen: string): string {
	return chosen.trim() || provider.defaultModel;
}

export interface ProviderRequest {
	url: string;
	headers: Record<string, string>;
	body: string;
}

/**
 * The request to send, in a shape `fetch` takes as it is.
 *
 * A pure function, and that is intended: this is where the key is put in a header rather than in an address,
 * and it is the only thing in this whole file a test can check with no network.
 */
export function buildRequest(
	provider: Provider,
	apiKey: string,
	model: string,
	prompt: string
): ProviderRequest {
	const name = modelFor(provider, model);

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
				messages: [{ role: 'user', content: prompt }]
			})
		};
	}

	if (provider.dialect === 'gemini') {
		return {
			url: `${provider.base}/models/${name}:generateContent`,
			headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
			body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
		};
	}

	return {
		url: `${provider.base}/chat/completions`,
		headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
		body: JSON.stringify({
			model: name,
			max_tokens: MAX_TOKENS,
			messages: [{ role: 'user', content: prompt }]
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
