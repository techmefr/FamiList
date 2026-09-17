import { describe, it, expect } from 'vitest';
import {
	buildRequest,
	isProvider,
	modelFor,
	parseError,
	parseReply,
	providerById,
	PROVIDERS
} from './ai';

const KEY = 'secret-de-la-personne';

describe('PROVIDERS', () => {
	it("n'expose que des fournisseurs joignables depuis un navigateur", () => {
		// OpenAI answers preflights but not the responses themselves: offering it would give an entry no browser
		// can call. This test is here so that an absent-minded addition fails rather than lands in the interface.
		expect(PROVIDERS.map(p => p.id)).not.toContain('openai');
	});

	it('appelle toujours une adresse en https', () => {
		for (const provider of PROVIDERS) {
			expect(provider.base.startsWith('https://')).toBe(true);
		}
	});

	it('donne un modele par defaut a chacun', () => {
		for (const provider of PROVIDERS) {
			expect(provider.defaultModel).not.toBe('');
		}
	});

	it('reconnait ses identifiants et rejette les autres', () => {
		expect(isProvider('anthropic')).toBe(true);
		expect(isProvider('openai')).toBe(false);
		expect(isProvider(null)).toBe(false);
		expect(providerById('inconnu')).toBeNull();
	});
});

describe('modelFor', () => {
	it('prend le modele choisi', () => {
		expect(modelFor(providerById('groq')!, 'un-autre')).toBe('un-autre');
	});

	it('retombe sur celui du fournisseur quand le champ est vide ou blanc', () => {
		const groq = providerById('groq')!;
		expect(modelFor(groq, '   ')).toBe(groq.defaultModel);
	});
});

describe('buildRequest', () => {
	/**
	 * The heart of the feature from a privacy point of view: a key put in an address ends up in the logs of
	 * the servers crossed, in the browser history and in the referrer header. Gemini accepts both forms, and it
	 * is precisely the one to watch.
	 */
	it("ne met jamais la cle dans l'adresse, pour aucun fournisseur", () => {
		for (const provider of PROVIDERS) {
			const request = buildRequest(provider, KEY, '', 'bonjour');
			expect(request.url).not.toContain(KEY);
		}
	});

	it('met la cle dans un en-tete, pour chaque fournisseur', () => {
		for (const provider of PROVIDERS) {
			const request = buildRequest(provider, KEY, '', 'bonjour');
			expect(Object.values(request.headers).join(' ')).toContain(KEY);
		}
	});

	it('envoie la consigne telle quelle dans le corps', () => {
		for (const provider of PROVIDERS) {
			const request = buildRequest(provider, KEY, '', 'du potiron et des lardons');
			expect(request.body).toContain('du potiron et des lardons');
		}
	});

	it('parle le dialecte anthropic avec son en-tete de navigateur', () => {
		const request = buildRequest(providerById('anthropic')!, KEY, 'modele-x', 'bonjour');

		expect(request.url).toBe('https://api.anthropic.com/v1/messages');
		expect(request.headers['x-api-key']).toBe(KEY);
		expect(request.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
		expect(request.headers['anthropic-version']).toBe('2023-06-01');
		expect(JSON.parse(request.body).model).toBe('modele-x');
	});

	it("passe la cle de gemini par l'en-tete et le modele par le chemin", () => {
		const request = buildRequest(providerById('gemini')!, KEY, 'gemini-test', 'bonjour');

		expect(request.url).toBe(
			'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent'
		);
		expect(request.headers['x-goog-api-key']).toBe(KEY);
		expect(request.url).not.toContain('key=');
	});

	it('parle le dialecte openai pour les quatre autres', () => {
		const request = buildRequest(providerById('mistral')!, KEY, '', 'bonjour');

		expect(request.url).toBe('https://api.mistral.ai/v1/chat/completions');
		expect(request.headers.authorization).toBe(`Bearer ${KEY}`);
		expect(JSON.parse(request.body).messages).toEqual([{ role: 'user', content: 'bonjour' }]);
	});
});

describe('parseReply', () => {
	it('lit la reponse anthropic', () => {
		const reply = parseReply(providerById('anthropic')!, {
			content: [{ type: 'text', text: 'une recette' }]
		});
		expect(reply).toBe('une recette');
	});

	it('lit la reponse gemini', () => {
		const reply = parseReply(providerById('gemini')!, {
			candidates: [{ content: { parts: [{ text: 'une recette' }] } }]
		});
		expect(reply).toBe('une recette');
	});

	it('lit la reponse openai-compatible', () => {
		const reply = parseReply(providerById('groq')!, {
			choices: [{ message: { role: 'assistant', content: 'une recette' } }]
		});
		expect(reply).toBe('une recette');
	});

	it('rend null sur une enveloppe inattendue plutot que de deviner', () => {
		for (const provider of PROVIDERS) {
			expect(parseReply(provider, {})).toBeNull();
			expect(parseReply(provider, null)).toBeNull();
			expect(parseReply(provider, 'texte brut')).toBeNull();
			expect(parseReply(provider, { content: [], candidates: [], choices: [] })).toBeNull();
		}
	});
});

describe('parseError', () => {
	it('lit le message des fournisseurs qui ecrivent sous error', () => {
		expect(parseError({ error: { message: 'API key is invalid.' } })).toBe('API key is invalid.');
	});

	it('lit le detail de mistral', () => {
		expect(parseError({ detail: 'Invalid API Key' })).toBe('Invalid API Key');
	});

	it('rend null quand rien n est exploitable', () => {
		expect(parseError({})).toBeNull();
		expect(parseError({ error: {} })).toBeNull();
		expect(parseError(null)).toBeNull();
	});
});
