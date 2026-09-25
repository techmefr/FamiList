import { describe, expect, it, vi } from 'vitest';
import { RELEASE_LOCALES } from '../domain/changelog';
import {
	NOTES_SCHEMA,
	PATCH_NOTES_MODEL,
	PatchNotesError,
	buildUserPrompt,
	generatePatchNotes,
	userFacingCommits,
	type ChangeCommit
} from './generate';

const commit = (type: string, description: string, extra: Partial<ChangeCommit> = {}): ChangeCommit => ({
	type,
	scope: 'recipes',
	description,
	body: '',
	isBreaking: false,
	...extra
});

const COMMITS = [
	commit('feat', 'timers on recipe steps', { pr: '#335', body: 'A step can carry a duration.' }),
	commit('fix', 'land on the filled form when editing a recipe', { pr: '#326' }),
	commit('ci', 'fix stores workflow syntax', { scope: '' }),
	commit('chore', 'bump driver.js', { scope: 'deps' }),
	commit('fix', 'bump a vulnerable dependency', { scope: 'deps' }),
	commit('refactor', 'split the cook-along component'),
	commit('test', 'cover loyalty cards', { scope: 'cards' }),
	commit('docs', 'translate the self-hosting guide', { scope: '' })
];

const validNotes = () =>
	Object.fromEntries(
		RELEASE_LOCALES.map((locale) => [
			locale,
			{ new: [`${locale}: timers on steps`], improved: [], fixed: [`${locale}: editing works`] }
		])
	);

/** A fetch standing in for OpenRouter's chat completions, answering with `content` as the message. */
function mockApi(
	content: string | null,
	{ finishReason = 'stop', refusal = null as string | null, status = 200 } = {}
) {
	return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
		new Response(
			JSON.stringify(
				status === 200
					? {
							id: 'gen-test',
							model: PATCH_NOTES_MODEL,
							choices: [{ finish_reason: finishReason, message: { role: 'assistant', content, refusal } }]
						}
					: { error: { message: 'Insufficient credits' } }
			),
			{ status, headers: { 'content-type': 'application/json' } }
		)
	);
}

const run = (fetchMock: ReturnType<typeof mockApi>, commits = COMMITS, model?: string) =>
	generatePatchNotes({
		version: '0.1.1',
		date: '2026-09-25',
		commits,
		apiKey: 'test-key',
		model,
		fetch: fetchMock as unknown as typeof fetch
	});

describe('userFacingCommits', () => {
	it('ne garde que feat, fix et perf, sans les dépendances', () => {
		expect(userFacingCommits(COMMITS).map((c) => c.description)).toEqual([
			'timers on recipe steps',
			'land on the filled form when editing a recipe'
		]);
	});

	it('garde un changement cassant quel que soit son type', () => {
		const breaking = commit('refactor', 'drop the old sign-in', { isBreaking: true });
		expect(userFacingCommits([breaking])).toEqual([breaking]);
	});
});

describe('buildUserPrompt', () => {
	it('liste les commits avec leur numéro de PR et les dix langues', () => {
		const prompt = buildUserPrompt('0.1.1', userFacingCommits(COMMITS));
		expect(prompt).toContain('Version 0.1.1.');
		expect(prompt).toContain('- feat(recipes): timers on recipe steps (#335)\n  A step can carry a duration.');
		expect(prompt).toContain('- fix(recipes): land on the filled form when editing a recipe (#326)');
		for (const locale of RELEASE_LOCALES) expect(prompt).toContain(`\n${locale}: `);
		expect(prompt).not.toContain('stores workflow');
	});

	it('coupe un corps de commit trop long', () => {
		const long = commit('feat', 'x', { body: 'a'.repeat(2000) });
		expect(buildUserPrompt('1.0.0', [long]).length).toBeLessThan(1200);
	});
});

describe('generatePatchNotes', () => {
	it('appelle le modèle avec un schéma JSON strict et rend une version valide', async () => {
		const fetchMock = mockApi(JSON.stringify(validNotes()));
		const release = await run(fetchMock);

		expect(release).toEqual({ version: '0.1.1', date: '2026-09-25', notes: validNotes() });

		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toBe('https://openrouter.ai/api/v1/chat/completions');
		const headers = new Headers(init?.headers);
		expect(headers.get('authorization')).toBe('Bearer test-key');
		expect(headers.get('x-title')).toBe('FamiList patch notes');
		const body = JSON.parse(String(init?.body));
		expect(body.model).toBe('anthropic/claude-sonnet-5');
		expect(body.response_format).toEqual({
			type: 'json_schema',
			json_schema: { name: 'patch_notes', strict: true, schema: NOTES_SCHEMA }
		});
		expect(body.messages[0].role).toBe('system');
		expect(body.messages[1].content).toContain('timers on recipe steps');
		expect(body.messages[1].content).not.toContain('split the cook-along');
	});

	it('prend le modèle demandé à la place du modèle par défaut', async () => {
		const fetchMock = mockApi(JSON.stringify(validNotes()));
		await run(fetchMock, COMMITS, 'google/gemini-3-flash');
		expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).model).toBe('google/gemini-3-flash');
	});

	it("remonte l'erreur d'OpenRouter", async () => {
		await expect(run(mockApi(null, { status: 402 }))).rejects.toThrow(
			'OpenRouter answered 402: Insufficient credits.'
		);
	});

	it("échoue quand une langue manque, sans rien rendre", async () => {
		const { mg: _mg, ...partial } = validNotes();
		await expect(run(mockApi(JSON.stringify(partial)))).rejects.toThrow(/notes\.mg: missing/);
	});

	it('échoue sur une réponse qui n’est pas du JSON', async () => {
		await expect(run(mockApi('Here are your notes!'))).rejects.toThrow('did not return valid JSON');
	});

	it('échoue sur un refus ou une réponse coupée', async () => {
		await expect(run(mockApi(null, { refusal: 'I cannot help with that.' }))).rejects.toThrow('declined');
		await expect(run(mockApi('{"fr":', { finishReason: 'length' }))).rejects.toThrow('cut off');
	});

	it("n'appelle pas le modèle quand rien ne concerne l'utilisateur", async () => {
		const fetchMock = mockApi('{}');
		await expect(run(fetchMock, [commit('ci', 'cache pnpm')])).rejects.toBeInstanceOf(PatchNotesError);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('refuse de partir sans clé', async () => {
		const fetchMock = mockApi('{}');
		await expect(
			generatePatchNotes({
				version: '0.1.1',
				date: '2026-09-25',
				commits: COMMITS,
				apiKey: '',
				fetch: fetchMock as unknown as typeof fetch
			})
		).rejects.toThrow('OPENROUTER_API_KEY is not set');
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
