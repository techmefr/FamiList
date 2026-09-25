/**
 * Writes the patch notes of the version `changelogen --bump` just put in package.json.
 *
 *   OPENROUTER_API_KEY=… [PATCH_NOTES_MODEL=anthropic/claude-sonnet-5] node scripts/patch-notes.ts
 *
 * Reads the conventional commits since the last `v*` tag with changelogen's own parser (the same ones it
 * wrote to CHANGELOG.md), asks a model on OpenRouter (Claude Sonnet 5 unless `PATCH_NOTES_MODEL` says
 * otherwise) for plain-language notes in the ten app locales, validates them and
 * adds them at the top of src/lib/changelog/releases.json. Exits non-zero, writing nothing, on any failure.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { getGitDiff, loadChangelogConfig, parseCommits } from 'changelogen';
import { generatePatchNotes, type ChangeCommit } from '../src/lib/changelog/generate.ts';
import { addRelease, parseReleases } from '../src/lib/domain/changelog.ts';

const RELEASES_PATH = 'src/lib/changelog/releases.json';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const config = await loadChangelogConfig(process.cwd());
const commits: ChangeCommit[] = parseCommits(await getGitDiff(config.from, config.to), config).map((commit) => ({
	type: commit.type.toLowerCase(),
	scope: commit.scope,
	description: commit.description,
	body: commit.body,
	pr: commit.references.find((reference) => reference.type === 'pull-request')?.value,
	isBreaking: commit.isBreaking
}));

console.error(`Patch notes for ${version}, from ${commits.length} commits since ${config.from || 'the beginning'}.`);

try {
	const release = await generatePatchNotes({
		version,
		date: new Date().toISOString().slice(0, 10),
		commits,
		apiKey: process.env.OPENROUTER_API_KEY ?? '',
		model: process.env.PATCH_NOTES_MODEL
	});
	const releases = parseReleases(addRelease(parseReleases(JSON.parse(readFileSync(RELEASES_PATH, 'utf8'))), release));
	writeFileSync(RELEASES_PATH, `${JSON.stringify(releases, null, '\t')}\n`);
	console.error(`Wrote ${RELEASES_PATH}.`);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
