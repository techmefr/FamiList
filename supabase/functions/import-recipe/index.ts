/**
 * Fetches a recipe page and returns what it declares as schema.org `Recipe`.
 *
 * The application is served statically: the browser cannot go and fetch a third-party page, CORS prevents
 * it. This function is the only place in the project that goes out to a third party, and it only goes out
 * where a signed-in person explicitly asks, one URL at a time.
 *
 * It returns nothing but fields: no database write. What comes back is a draft to review, not a recipe. It
 * is the screen that prefills the form, and the person who saves.
 *
 * The guards against being turned into an open proxy live in `url.ts` and are replayed at every redirect: a
 * public URL redirecting to `169.254.169.254` is the obvious attack.
 */

import { checkUrl } from './url.ts';
import { extractRecipe, readableText } from './extract.ts';

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

/** A million bytes is amply enough for a recipe page, JSON-LD headers included. */
const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

const json = (body: unknown, status = 200): Response =>
	Response.json(body, { status, headers: CORS });

/** Reads at most MAX_BYTES: an announced `Content-Length` proves nothing, we count what arrives. */
async function readCapped(response: Response): Promise<string | null> {
	const body = response.body;
	if (!body) return null;

	const reader = body.getReader();
	const decoder = new TextDecoder('utf-8');
	let size = 0;
	let html = '';

	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;

			size += value.byteLength;
			if (size > MAX_BYTES) return null;

			html += decoder.decode(value, { stream: true });
		}
	} finally {
		await reader.cancel().catch(() => undefined);
	}

	return html + decoder.decode();
}

/**
 * Follows redirects by hand. `redirect: 'follow'` would follow them without showing them to us, and the
 * guard would then apply only to the first link — which guards nothing.
 */
async function fetchPage(start: URL): Promise<Response | null> {
	let target = start;

	for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
		const response = await fetch(target, {
			redirect: 'manual',
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: {
				// Introducing ourselves rather than disguising ourselves: a site that does not want us must be able to
				// refuse us, and we must be able to accept that.
				'User-Agent': 'FamiListeRecipeImport/1.0 (+https://familiste.app)',
				Accept: 'text/html,application/xhtml+xml'
			}
		});

		const location = response.headers.get('location');
		if (response.status < 300 || response.status >= 400 || !location) return response;

		await response.body?.cancel().catch(() => undefined);

		const next = checkUrl(new URL(location, target).toString());
		if (!next.ok) return null;
		target = next.url;
	}

	return null;
}

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
	if (request.method !== 'POST') return json({ error: 'method' }, 405);

	let raw = '';
	try {
		const body = await request.json();
		raw = typeof body?.url === 'string' ? body.url.trim() : '';
	} catch {
		return json({ error: 'invalid' }, 400);
	}

	const checked = checkUrl(raw);
	if (!checked.ok) return json({ error: checked.reason }, 400);

	let response: Response | null;
	try {
		response = await fetchPage(checked.url);
	} catch (error) {
		// The requested URL does not appear in the logs: it is an address somebody chose to entrust to us for a
		// single request, not a trace to keep.
		console.error('import-recipe: echec reseau', String(error instanceof Error ? error.name : error));
		return json({ error: 'unreachable' }, 502);
	}

	if (!response || !response.ok) return json({ error: 'unreachable' }, 502);

	const type = response.headers.get('content-type') ?? '';
	if (!/text\/html|application\/xhtml/i.test(type)) {
		await response.body?.cancel().catch(() => undefined);
		return json({ error: 'not_html' }, 415);
	}

	const html = await readCapped(response);
	if (html === null) return json({ error: 'too_large' }, 413);

	const recipe = extractRecipe(html);
	if (!recipe) {
		// No structured data found: the client may still offer its own AI fallback with this text, but only the
		// client decides that, with the person's own key. Nothing here calls an AI provider.
		return json({ error: 'no_recipe', text: readableText(html) }, 422);
	}

	return json(recipe);
});
