/**
 * Points a fresh Supabase project at this repository: schema, functions, and the two values to give the app.
 *
 * All of it can be typed by hand — it is five commands and one of them is a loop over a folder. The point
 * of having it here is that the folder is the authority: a function added to `supabase/functions` is
 * deployed by this script without anybody remembering to add a line to a page of documentation, which is
 * exactly the line that gets forgotten and turns into "the recipe import does nothing on my instance".
 *
 *   pnpm setup --ref <project-ref>   links, pushes the schema, deploys the functions
 *   pnpm setup --dry-run             prints what it would run, runs nothing
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync } from 'node:fs';
import process from 'node:process';

const USAGE = `Usage:
  pnpm setup --ref <project-ref>
  pnpm setup --dry-run

The project ref is in the address of your project on supabase.com:
https://supabase.com/dashboard/project/<project-ref>

For a stack at home, nothing to link: "pnpm db:start" applies the schema by itself.`;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const refFlag = args.indexOf('--ref');
const ref = refFlag === -1 ? null : args[refFlag + 1];

if (args.includes('--help')) {
	console.log(USAGE);
	process.exit(0);
}

if (refFlag === -1 && !dryRun) {
	console.error('Nothing to link to.\n\n' + USAGE);
	process.exit(1);
}

if (refFlag !== -1 && (!ref || ref.startsWith('--'))) {
	console.error('--ref expects the reference of the project.\n\n' + USAGE);
	process.exit(1);
}

/**
 * Runs one Supabase command, showing it first.
 *
 * Standard input is inherited rather than captured: `link` asks for the database password, and a script
 * that swallowed that prompt would look frozen. Seeing the command also means somebody who prefers to
 * carry on by hand can, from wherever this stopped.
 */
function supabase(argv) {
	console.log('\n$ pnpm exec supabase ' + argv.join(' '));

	if (dryRun) return;

	const result = spawnSync('pnpm', ['exec', 'supabase', ...argv], { stdio: 'inherit', shell: false });

	if (result.status !== 0) {
		console.error('\nStopped there. Nothing after this has run.');
		process.exit(result.status ?? 1);
	}
}

/** Every folder of `supabase/functions`, minus the shared code, which is not a function. */
function functions() {
	return readdirSync('supabase/functions', { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
		.map((entry) => entry.name)
		.sort();
}

if (!existsSync('supabase/functions')) {
	console.error('Run this from the root of the repository.');
	process.exit(1);
}

if (ref) supabase(['link', '--project-ref', ref]);

supabase(['db', 'push']);

for (const name of functions()) supabase(['functions', 'deploy', name]);

if (dryRun) {
	console.log('\nDry run: nothing was run.');
	process.exit(0);
}

if (!existsSync('.env') && existsSync('.env.example')) {
	copyFileSync('.env.example', '.env');
	console.log('\nCreated .env from .env.example.');
}

console.log(`
Done. Three things left, none of them in a terminal:

  1. Put the project URL and the "anon public" key in .env — or in the environment variables of
     your host, if you deploy there rather than with docker compose. Both are in Project settings,
     API.

  2. In Authentication, set the site URL and the redirect URLs to your real domain. Without that,
     the link people receive by email leads somewhere else.

  3. Name your administrator:

       SUPABASE_SERVICE_ROLE_KEY=... pnpm admin create

Never run supabase/seed.sql against this project: it creates a test account whose password is in
the repository.`);
