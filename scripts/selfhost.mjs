/**
 * Brings up a Supabase of your own, in Docker, and puts this schema in it.
 *
 * Supabase publishes a self-hosting bundle and a `setup.sh` that generates the secrets and the API keys.
 * That bundle is fetched at a pinned version rather than copied into this repository: a dozen containers
 * whose versions move together, vendored here, would be a fork of theirs going stale — and the day it
 * matters is the day a security fix lands upstream and not in the copy.
 *
 * What is left for this script is the part that is ours: starting the stack, applying the migrations, and
 * handing the application the two values it needs.
 *
 *   pnpm selfhost            fetches, configures and starts, then applies the schema
 *   pnpm selfhost --schema   applies the schema to a stack already running
 *
 * `pnpm db:start` is a different thing and stays: a development stack with fixed, public keys, thrown away
 * and rebuilt on a whim. This one has secrets generated for you and is meant to hold real data.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

/**
 * The version of the self-hosting bundle, pinned.
 *
 * Moving it is a deliberate change with a diff to read, not something that happens to whoever installs on
 * a Tuesday. Their tags are `self-hosted/v*`.
 */
const BUNDLE = 'self-hosted/v0.8.1';

const STACK_DIR = 'supabase-stack';

const USAGE = `Usage:
  pnpm selfhost             fetch, configure, start, then apply the schema
  pnpm selfhost --schema    apply the schema to a stack that is already running

The stack lands in ./${STACK_DIR}, which is not versioned: it holds your secrets.`;

const args = process.argv.slice(2);

if (args.includes('--help')) {
	console.log(USAGE);
	process.exit(0);
}

const schemaOnly = args.includes('--schema');

function run(command, argv, options = {}) {
	console.log('\n$ ' + [command, ...argv].join(' '));

	const result = spawnSync(command, argv, { stdio: 'inherit', ...options });

	if (result.status !== 0) {
		console.error('\nStopped there. Nothing after this has run.');
		process.exit(result.status ?? 1);
	}
}

/** Reads one value out of the stack's own `.env`, which its setup wrote. */
function stackEnv(name) {
	const file = readFileSync(join(STACK_DIR, '.env'), 'utf8');
	const match = new RegExp(`^${name}=(.*)$`, 'm').exec(file);

	return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
}

if (!existsSync('supabase/migrations')) {
	console.error('Run this from the root of the repository.');
	process.exit(1);
}

if (!schemaOnly) {
	if (existsSync(STACK_DIR)) {
		console.error(
			`./${STACK_DIR} already exists. "pnpm selfhost --schema" reapplies the schema to it; delete the\n` +
				'folder to start over — which also throws away its secrets, and the data behind them.'
		);
		process.exit(1);
	}

	// Their script, at our pinned version. `--skip-deps` because it would otherwise install Docker
	// system-wide, which is not a thing a project script should do behind somebody's back; `-y` to keep the
	// defaults, which serve the stack on localhost:8000.
	run('sh', ['-c', `curl -fsSL https://raw.githubusercontent.com/supabase/supabase/${BUNDLE}/docker/setup.sh | sh -s -- -y --skip-deps --ref ${BUNDLE} --project-dir ${STACK_DIR}`]);

	run('docker', ['compose', 'up', '-d'], { cwd: STACK_DIR });
	await waitForDatabase();
}

/**
 * Waits for Postgres to answer before pushing anything at it.
 *
 * `compose up -d` returns as soon as the containers are started, not when the database is ready to be
 * talked to. Pushing the migrations right then fails on a connection refused, which reads like a broken
 * script rather than the half-second of patience it actually is.
 */
async function waitForDatabase() {
	process.stdout.write('\nWaiting for the database');

	for (let attempt = 0; attempt < 60; attempt += 1) {
		const ready = spawnSync('docker', ['compose', 'exec', '-T', 'db', 'pg_isready', '-U', 'postgres'], {
			cwd: STACK_DIR,
			stdio: 'ignore'
		});

		if (ready.status === 0) {
			console.log(' — ready.');
			return;
		}

		process.stdout.write('.');
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}

	console.error('\nThe database never answered. "docker compose logs db" in ' + STACK_DIR + ' says why.');
	process.exit(1);
}

const password = stackEnv('POSTGRES_PASSWORD');
const anonKey = stackEnv('ANON_KEY');
const publicUrl = stackEnv('SUPABASE_PUBLIC_URL') || 'http://localhost:8000';

if (!password || !anonKey) {
	console.error(`Could not read POSTGRES_PASSWORD and ANON_KEY from ${STACK_DIR}/.env.`);
	process.exit(1);
}

// Through the pooler their compose publishes, rather than through the CLI's linked-project path: there is
// no project on supabase.com to link to here.
//
// The user carries the tenant — `postgres.<tenant>` — because that published port is Supavisor, not
// Postgres: a plain `postgres` is refused for want of a tenant identifier, in a message that says nothing
// about which of the two you reached.
//
// `sslmode=disable` because it does not serve TLS and the CLI insists by default. The connection never
// leaves the machine: loopback, to a port their compose publishes there. Whatever can reach it is already
// inside.
const port = stackEnv('POSTGRES_PORT') || '5432';
const tenant = stackEnv('POOLER_TENANT_ID');
const user = tenant ? `postgres.${tenant}` : 'postgres';
const dbUrl = `postgresql://${user}:${encodeURIComponent(password)}@127.0.0.1:${port}/postgres?sslmode=disable`;

run('pnpm', ['exec', 'supabase', 'db', 'push', '--db-url', dbUrl]);

if (!existsSync('.env')) {
	writeFileSync('.env', `PUBLIC_SUPABASE_URL=${publicUrl}\nPUBLIC_SUPABASE_ANON_KEY=${anonKey}\nPORT=8080\n`);
	console.log('\nWrote .env, pointing at the stack.');
} else {
	console.log(`
Your .env already exists; it was left alone. The two values for this stack are:

  PUBLIC_SUPABASE_URL=${publicUrl}
  PUBLIC_SUPABASE_ANON_KEY=${anonKey}`);
}

console.log(`
The stack is up. Two things left:

  1. Name your administrator:

       SUPABASE_SERVICE_ROLE_KEY=$(grep '^SERVICE_ROLE_KEY=' ${STACK_DIR}/.env | cut -d= -f2) pnpm admin create

  2. Start the app:

       docker compose up -d

${STACK_DIR}/.env holds every secret of this instance, and ${STACK_DIR} is not versioned. Back it up
somewhere, and back up the database: a self-hosted stack is yours, including that part.`);
