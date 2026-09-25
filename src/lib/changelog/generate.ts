import {
	NOTE_GROUPS,
	RELEASE_LOCALES,
	releaseNotesProblems,
	type Release
} from '../domain/changelog.ts';

/**
 * Turns the conventional commits of one release into the patch notes people read in the app.
 *
 * Only the release script imports this file; the app never calls it. Relative imports with their `.ts`
 * extension, because Node runs the script straight from the TypeScript source, with no bundler to resolve
 * `$domain`.
 */

/**
 * Through OpenRouter rather than a provider's own API: the project already relies on it for dish photos,
 * and one key then covers every model, so switching the one writing the notes is a variable, not a code
 * change (`PATCH_NOTES_MODEL` in the workflow).
 */
export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const PATCH_NOTES_MODEL = 'anthropic/claude-sonnet-5';

export interface ChangeCommit {
	type: string;
	scope: string;
	description: string;
	body: string;
	/** `#123`, when the squash-merge title carried the pull request number. */
	pr?: string;
	isBreaking: boolean;
}

/**
 * The commit types that can change what somebody sees or feels in the app. `ci`, `chore`, `refactor`,
 * `test`, `docs`, `build` and `style` never do — dropping them here, before the model, is cheaper and more
 * reliable than asking it to ignore them.
 */
const USER_FACING_TYPES = new Set(['feat', 'fix', 'perf']);

/** The body of a squash merge is the whole PR description; past this it is test plans and checklists. */
const MAX_BODY_LENGTH = 700;

export function userFacingCommits(commits: ChangeCommit[]): ChangeCommit[] {
	return commits.filter(
		(commit) =>
			(USER_FACING_TYPES.has(commit.type) || commit.isBreaking) &&
			commit.scope !== 'deps' &&
			commit.scope !== 'release'
	);
}

const LOCALE_NAMES: Record<(typeof RELEASE_LOCALES)[number], string> = {
	fr: 'French (reference language of the app)',
	en: 'English',
	es: 'Spanish',
	de: 'German',
	it: 'Italian',
	pt: 'European Portuguese',
	ru: 'Russian',
	ar: 'Modern Standard Arabic',
	zh: 'Simplified Chinese',
	mg: 'Malagasy'
};

export const SYSTEM_PROMPT = `You write the "What's new" notes of FamiList, a shared shopping-list and recipe app whose most important users are seniors.

Rules:
- Plain, warm, everyday words. No technical jargon: never mention code, databases, sync, APIs, pull requests, commits, frameworks, CI or file names.
- One short sentence per note, ideally under 120 characters, saying what the person can now do or what works better.
- Group every note as "new" (something the person could not do before), "improved" (something that already existed and got better) or "fixed" (something that did not work properly and now does).
- Merge commits that describe the same feature into a single note. Leave out anything with no visible effect for the person using the app.
- Stay strictly accurate to the commits. Never invent a feature, a number or a benefit that the commits do not state.
- Write the same notes, in the same order, in every requested language. Translate naturally, the way a native speaker would say it, not word for word. Keep product names such as "Famy" and "FamiList" unchanged.
- A group with nothing in it is an empty list.`;

export function buildUserPrompt(version: string, commits: ChangeCommit[]): string {
	const lines = commits.map((commit) => {
		const head = `- ${commit.type}${commit.scope ? `(${commit.scope})` : ''}: ${commit.description}${commit.pr ? ` (${commit.pr})` : ''}`;
		const body = commit.body.trim().slice(0, MAX_BODY_LENGTH);
		return body ? `${head}\n  ${body.replace(/\n+/g, '\n  ')}` : head;
	});
	const languages = RELEASE_LOCALES.map((locale) => `${locale}: ${LOCALE_NAMES[locale]}`).join('\n');

	return `Version ${version}. These are the changes merged since the previous release:

${lines.join('\n')}

Write the notes in these languages, keyed by the code on the left:
${languages}`;
}

const GROUPS_SCHEMA = {
	type: 'object',
	properties: Object.fromEntries(NOTE_GROUPS.map((group) => [group, { type: 'array', items: { type: 'string' } }])),
	required: [...NOTE_GROUPS],
	additionalProperties: false
};

export const NOTES_SCHEMA = {
	type: 'object',
	properties: Object.fromEntries(RELEASE_LOCALES.map((locale) => [locale, GROUPS_SCHEMA])),
	required: [...RELEASE_LOCALES],
	additionalProperties: false
};

export interface GenerateOptions {
	version: string;
	date: string;
	commits: ChangeCommit[];
	apiKey: string;
	/** An OpenRouter model id; empty falls back to `PATCH_NOTES_MODEL`. */
	model?: string;
	/** Injected by the tests; the real run uses the global `fetch`. */
	fetch?: typeof fetch;
}

export class PatchNotesError extends Error {}

interface ChatCompletion {
	choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
	error?: { message?: string };
}

/**
 * One call, structured output, then the same strict validation as the committed file.
 *
 * The JSON schema already asks the model for the ten locales and three groups; the validator runs anyway
 * because not every model behind OpenRouter enforces a schema, because it also checks what the schema does
 * not say (no empty strings, no overlong notes), and because a release that reached `releases.json`
 * half-translated would show English to nine languages without anybody noticing.
 */
export async function generatePatchNotes(options: GenerateOptions): Promise<Release> {
	const commits = userFacingCommits(options.commits);
	if (commits.length === 0) {
		throw new PatchNotesError(
			`Nothing user-facing since the last release (only ci, chore, refactor, test, docs or deps commits): no patch notes to write for ${options.version}.`
		);
	}
	if (!options.apiKey) throw new PatchNotesError('OPENROUTER_API_KEY is not set.');

	const response = await (options.fetch ?? fetch)(OPENROUTER_CHAT_URL, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${options.apiKey}`,
			'HTTP-Referer': 'https://github.com/techmefr/FamiList',
			'X-Title': 'FamiList patch notes'
		},
		body: JSON.stringify({
			model: options.model || PATCH_NOTES_MODEL,
			max_tokens: 16000,
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content: buildUserPrompt(options.version, commits) }
			],
			response_format: {
				type: 'json_schema',
				json_schema: { name: 'patch_notes', strict: true, schema: NOTES_SCHEMA }
			}
		})
	});

	const payload = (await response.json().catch(() => ({}))) as ChatCompletion;
	if (!response.ok) {
		throw new PatchNotesError(`OpenRouter answered ${response.status}: ${payload.error?.message ?? 'no details'}.`);
	}

	const choice = payload.choices?.[0];
	if (choice?.message?.refusal) throw new PatchNotesError('The model declined to write the notes.');
	if (choice?.finish_reason === 'length') throw new PatchNotesError('The notes were cut off (max_tokens).');

	let notes: unknown;
	try {
		notes = JSON.parse(choice?.message?.content ?? '');
	} catch {
		throw new PatchNotesError('The model did not return valid JSON.');
	}

	const problems = releaseNotesProblems(notes);
	if (problems.length > 0) throw new PatchNotesError(`Invalid patch notes:\n- ${problems.join('\n- ')}`);

	return { version: options.version, date: options.date, notes: notes as Release['notes'] };
}
