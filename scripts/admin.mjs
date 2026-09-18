/**
 * Creates or promotes the administrator of an instance.
 *
 * Without this, the only way in is "the first account created wins", which is a race: on an instance that
 * has just gone live, anybody who signs up before you owns it. That rule stays — it keeps a fresh database
 * from being a dead end — but it stops being the only way, and going live no longer has to be a sprint.
 *
 * Runs outside the application, with the service key, because that is precisely what the application must
 * never hold: a browser that could promote an account could promote any account.
 *
 *   pnpm admin create            creates a confirmed, approved administrator
 *   pnpm admin promote <email>   promotes an account that already exists
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import process from 'node:process';

const USAGE = `Usage:
  pnpm admin create
  pnpm admin promote <email>

Environment:
  SUPABASE_URL or PUBLIC_SUPABASE_URL   the address of the instance (read from .env if present)
  SUPABASE_SERVICE_ROLE_KEY             the service key, from Project settings > API`;

/**
 * Reads `.env` for the address only.
 *
 * The service key is deliberately not read from there: that file is also what feeds the container and the
 * browser bundle, and a key that can bypass every RLS policy has no business sitting next to two values
 * whose whole point is to be public. It is passed for the length of one command and forgotten.
 */
function envFile() {
	try {
		const values = {};
		for (const line of readFileSync('.env', 'utf8').split('\n')) {
			const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
			if (match) values[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
		}
		return values;
	} catch {
		return {};
	}
}

/**
 * Answers waiting on standard input, when it is not a terminal.
 *
 * A pipe hands everything over at once and then ends, which closes a readline interface before the second
 * question is asked. So the lines are read once, at the first question, and served from there. A terminal
 * keeps its interface open and is asked question by question, as a person expects.
 *
 * Read at the first question and not before: `promote` asks nothing, and waiting on a standard input that
 * nobody is going to close would hang a command that had no question to put.
 */
let piped = null;

const terminal = process.stdin.isTTY
	? createInterface({ input: process.stdin, output: process.stdout })
	: null;

async function pipedLines() {
	piped ??= (
		await new Promise((resolve) => {
			let text = '';
			process.stdin.setEncoding('utf8');
			process.stdin.on('data', (chunk) => (text += chunk));
			process.stdin.on('end', () => resolve(text));
		})
	).split('\n');

	return piped;
}

/** Asks one question. `hidden` stops the answer from being echoed, for a password. */
async function ask(question, hidden = false) {
	process.stdout.write(question);

	if (!terminal) return (await pipedLines()).shift() ?? '';

	return new Promise((resolve) => {
		// The typed characters are not echoed: a password scrolling past in a terminal ends up in a screen
		// share, a screenshot, or over somebody's shoulder.
		if (hidden) terminal._writeToOutput = () => {};

		terminal.question('', (answer) => {
			if (hidden) {
				terminal._writeToOutput = undefined;
				process.stdout.write('\n');
			}

			resolve(answer);
		});
	});
}

function fail(message) {
	console.error(message);
	process.exit(1);
}

function done() {
	terminal?.close();
	process.exit(0);
}

const [command, argument] = process.argv.slice(2);

if (!command || !['create', 'promote'].includes(command)) fail(USAGE);

const file = envFile();
const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || file.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) fail('No instance address. Set SUPABASE_URL, or fill PUBLIC_SUPABASE_URL in .env.\n\n' + USAGE);
if (!serviceKey) fail('No service key. Set SUPABASE_SERVICE_ROLE_KEY for this command.\n\n' + USAGE);

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

/** Promotes a profile to an approved administrator, whatever state it was in. */
async function promote(userId, email) {
	const { error } = await supabase
		.from('profiles')
		.update({ role: 'admin', status: 'approved', reviewed_at: new Date().toISOString() })
		.eq('id', userId);

	if (error) fail('Could not promote the account: ' + error.message);

	console.log(`${email} is an administrator, approved.`);
}

/** Looks an account up by email, paging because the admin API does not filter. */
async function findByEmail(email) {
	const wanted = email.trim().toLowerCase();

	for (let page = 1; page <= 50; page += 1) {
		const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });

		if (error) fail('Could not read the accounts: ' + error.message);

		const found = data.users.find((user) => user.email?.toLowerCase() === wanted);
		if (found) return found;
		if (data.users.length < 200) return null;
	}

	return null;
}

if (command === 'promote') {
	if (!argument) fail(USAGE);

	const user = await findByEmail(argument);
	if (!user) fail(`No account for ${argument}. Sign up first, or use "pnpm admin create".`);

	await promote(user.id, user.email);
	done();
}

const email = (await ask('Email of the administrator: ')).trim();
if (!email.includes('@')) fail('That is not an email address.');

const existing = await findByEmail(email);

if (existing) {
	console.log('That account already exists; promoting it rather than creating a second one.');
	await promote(existing.id, existing.email);
	done();
}

const password = await ask('Password: ', true);
if (password.length < 8) fail('Password too short: eight characters at least.');

const confirmation = await ask('Password again: ', true);
if (password !== confirmation) fail('The two passwords do not match.');

const displayName = (await ask('Display name (optional): ')).trim();

// Confirmed outright: the instance may not be able to send email yet — that is configured from /admin,
// which needs an administrator, which is this command. Waiting for a confirmation link here would be a
// circle.
const { data, error } = await supabase.auth.admin.createUser({
	email,
	password,
	email_confirm: true,
	user_metadata: displayName ? { display_name: displayName } : undefined
});

if (error) fail('Could not create the account: ' + error.message);

await promote(data.user.id, data.user.email);
done();
