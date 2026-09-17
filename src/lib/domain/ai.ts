/**
 * Les fournisseurs d'intelligence artificielle appelables depuis un navigateur.
 *
 * Toute cette application est une page statique : il n'y a pas de serveur a nous, et aucune cle
 * n'est posee par l'hebergeur. L'appel part donc du navigateur de la personne, avec sa cle a elle.
 * Cela restreint la liste bien plus que le catalogue du marche ne le laisse croire, et c'est la
 * seule raison pour laquelle certains noms attendus manquent ici.
 *
 * Ce qui a ete verifie, fournisseur par fournisseur, en envoyant une vraie requete avec un
 * en-tete `Origin` : le prevol `OPTIONS` passe, **et** la reponse du `POST` porte elle aussi
 * `access-control-allow-origin`. Les deux sont necessaires — un navigateur qui obtient le prevol
 * mais lit une reponse sans en-tete jette quand meme le resultat, et le code appelant ne recoit
 * qu'un echec reseau sans explication.
 *
 * OpenAI echoue precisement a la deuxieme condition et n'est donc pas propose. Son prevol repond
 * `access-control-allow-origin`, mais la reponse du `POST` ne le fait pas : depuis une page, la
 * requete part et le resultat est inaccessible. `dangerouslyAllowBrowser` du SDK officiel ne
 * change rien a cela — cette option leve un garde-fou du SDK, pas la regle du navigateur. Le
 * proposer dans la liste donnerait une case a cocher qui ne peut pas fonctionner, ce qui est pire
 * que son absence.
 *
 * Aucune cle ne voyage dans une adresse. Gemini accepte la sienne en parametre de requete
 * (`?key=`), et c'est la forme que montre sa documentation ; on utilise l'en-tete
 * `x-goog-api-key`, qu'il accepte tout autant. Une adresse se retrouve dans les journaux des
 * serveurs traverses, dans l'historique du navigateur et dans l'en-tete de provenance de la
 * requete suivante — trois endroits ou une cle de paiement n'a rien a faire.
 */

/** Les formes de requete. Quatre fournisseurs sur six parlent le dialecte d'OpenAI. */
type Dialect = 'openai' | 'anthropic' | 'gemini';

export interface Provider {
	id: string;
	dialect: Dialect;
	/** Racine de l'API, sans barre oblique finale. */
	base: string;
	/** Le modele appele quand la personne n'en a pas choisi un autre. */
	defaultModel: string;
	/** Ou la personne va chercher sa cle. Affiche tel quel, jamais traduit. */
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
		defaultModel: 'gemini-2.0-flash',
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

/** Le modele reellement appele : celui qu'on a choisi, sinon celui du fournisseur. */
export function modelFor(provider: Provider, chosen: string): string {
	return chosen.trim() || provider.defaultModel;
}

export interface ProviderRequest {
	url: string;
	headers: Record<string, string>;
	body: string;
}

/**
 * La requete a envoyer, sous une forme que `fetch` prend telle quelle.
 *
 * Fonction pure, et c'est voulu : c'est ici que la cle est posee dans un en-tete plutot que dans
 * une adresse, et c'est la seule chose de tout ce fichier qu'un test peut verifier sans reseau.
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
				// Sans cet en-tete, le SDK comme l'API refusent une requete venue d'une page. Il vaut
				// reconnaissance du risque : la cle est dans le navigateur, elle appartient a la
				// personne qui l'a posee, et c'est precisement le choix que cette fonctionnalite acte.
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

/** De quoi ecrire une recette complete, et rien de plus : on ne paie pas une dissertation. */
const MAX_TOKENS = 1200;

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const firstOf = (value: unknown): unknown => (Array.isArray(value) ? value[0] : undefined);

/**
 * Le texte rendu par le fournisseur, ou null si la reponse n'a pas la forme attendue.
 *
 * On descend champ par champ plutot qu'en chainant les points d'interrogation : une reponse
 * d'erreur a la meme enveloppe qu'une reponse valide chez plusieurs fournisseurs, et un acces
 * optionnel non garde rendrait `undefined` la ou il faut distinguer « rien a lire » de « chaine
 * vide ».
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
 * Ce que le fournisseur reproche, en une phrase, ou null s'il ne dit rien d'exploitable.
 *
 * Les six n'ecrivent pas leurs erreurs au meme endroit : `error.message` chez la plupart, `detail`
 * chez Mistral. Rendre le message du fournisseur plutot qu'un texte a nous est ici le bon choix —
 * « credit epuise » et « modele inconnu » demandent deux gestes differents, et seule la personne
 * qui possede le compte peut agir sur l'un comme sur l'autre.
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
