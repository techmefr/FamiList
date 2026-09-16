/**
 * Recupere une page de recette et rend ce qu elle declare en schema.org `Recipe`.
 *
 * L application est servie en statique : le navigateur ne peut pas aller chercher une page tierce,
 * CORS l en empeche. Cette fonction est le seul endroit du projet qui sorte vers un tiers, et elle
 * ne sort que la ou une personne connectee le demande explicitement, une URL a la fois.
 *
 * Elle ne rend rien d autre que des champs : aucune ecriture en base. Ce qui revient est un
 * brouillon a relire, pas une recette. C est l ecran qui pre-remplit le formulaire, et la personne
 * qui enregistre.
 *
 * Les gardes contre le detournement en proxy ouvert vivent dans `url.ts` et sont rejouees a chaque
 * redirection : une URL publique qui redirige vers `169.254.169.254` est l attaque evidente.
 */

import { checkUrl } from './url.ts';
import { extractRecipe } from './extract.ts';

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

/** Un million d octets suffit tres largement a une page de recette, entetes JSON-LD compris. */
const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

const json = (body: unknown, status = 200): Response =>
	Response.json(body, { status, headers: CORS });

/** Lit au plus MAX_BYTES : un `Content-Length` annonce ne prouve rien, on compte ce qui arrive. */
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
 * Suit les redirections a la main. `redirect: 'follow'` les suivrait sans nous les montrer, et la
 * garde ne s appliquerait alors qu au premier maillon — ce qui ne garde rien.
 */
async function fetchPage(start: URL): Promise<Response | null> {
	let target = start;

	for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
		const response = await fetch(target, {
			redirect: 'manual',
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: {
				// Se presenter plutot que se deguiser : un site qui ne veut pas de nous doit pouvoir
				// nous refuser, et nous devons pouvoir l accepter.
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
		// L URL demandee n apparait pas dans les journaux : c est une adresse que quelqu un a
		// choisi de nous confier pour une seule requete, pas une trace a conserver.
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
	if (!recipe) return json({ error: 'no_recipe' }, 422);

	return json(recipe);
});
