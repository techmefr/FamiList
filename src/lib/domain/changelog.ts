/**
 * What each release brought, and how to tell "seen" from "not seen".
 *
 * The prose lives in `src/lib/changelog/releases.json`, not in the locale files: it is written by the
 * release workflow (see `scripts/patch-notes.ts`), once per version, in every language at once. Keeping it
 * out of the locale files means a release never touches the UI strings, and a translator never has to wade
 * through a growing history to find a button label.
 *
 * This module is pure and imported by both the app and the Node release script, which is why it has no
 * alias import and no dependency on the i18n store.
 */

/** The ten app locales, in the order of `LOCALES`. A release missing any one of them is refused. */
export const RELEASE_LOCALES = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'ar', 'zh', 'mg'] as const;
export type ReleaseLocale = (typeof RELEASE_LOCALES)[number];

export const NOTE_GROUPS = ['new', 'improved', 'fixed'] as const;
export type NoteGroup = (typeof NOTE_GROUPS)[number];

export type ReleaseNotes = Record<NoteGroup, string[]>;

export interface Release {
	/** `major.minor.patch`, matching `package.json`'s `version` at the time of release. */
	version: string;
	/** `YYYY-MM-DD`, the day the release was prepared. */
	date: string;
	notes: Record<ReleaseLocale, ReleaseNotes>;
}

const VERSION_RE = /^\d+\.\d+\.\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A note longer than this is a paragraph, not a line someone skims on a phone. */
export const MAX_NOTE_LENGTH = 280;

/**
 * Compares two `major.minor.patch` strings. Negative when `a` is older than `b`, positive when newer, zero
 * when equal.
 *
 * No semver library in the app bundle: every version here is produced by `changelogen` or written by hand,
 * so the three-number shape can be trusted without a parser built to tolerate the wider spec.
 */
export function compareVersions(a: string, b: string): number {
	const partsOf = (version: string) => {
		const [major = 0, minor = 0, patch = 0] = version.split('.').map((part) => Number(part) || 0);
		return [major, minor, patch];
	};
	const [aMajor, aMinor, aPatch] = partsOf(a);
	const [bMajor, bMinor, bPatch] = partsOf(b);

	if (aMajor !== bMajor) return aMajor - bMajor;
	if (aMinor !== bMinor) return aMinor - bMinor;
	return aPatch - bPatch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function notesProblems(value: unknown, where: string): string[] {
	if (!isRecord(value)) return [`${where}: expected an object with new, improved and fixed`];

	const problems: string[] = [];
	for (const key of Object.keys(value)) {
		if (!(NOTE_GROUPS as readonly string[]).includes(key)) problems.push(`${where}: unknown group "${key}"`);
	}
	for (const group of NOTE_GROUPS) {
		const items = value[group];
		if (!Array.isArray(items)) {
			problems.push(`${where}.${group}: expected an array`);
			continue;
		}
		items.forEach((item, index) => {
			if (typeof item !== 'string' || item.trim() === '') {
				problems.push(`${where}.${group}[${index}]: expected a non-empty string`);
			} else if (item.length > MAX_NOTE_LENGTH) {
				problems.push(`${where}.${group}[${index}]: longer than ${MAX_NOTE_LENGTH} characters`);
			}
		});
	}
	return problems;
}

/**
 * Every problem with one release's notes, across the ten locales. Empty means valid.
 *
 * Strict on purpose: an unknown locale or group is as much an error as a missing one — it is almost always a
 * typo (`"fixes"`, `"pt-BR"`) that would otherwise make a language silently fall back to English.
 */
export function releaseNotesProblems(value: unknown, where = 'notes'): string[] {
	if (!isRecord(value)) return [`${where}: expected an object keyed by locale`];

	const problems: string[] = [];
	for (const key of Object.keys(value)) {
		if (!(RELEASE_LOCALES as readonly string[]).includes(key)) problems.push(`${where}: unknown locale "${key}"`);
	}
	for (const locale of RELEASE_LOCALES) {
		if (!(locale in value)) {
			problems.push(`${where}.${locale}: missing`);
			continue;
		}
		problems.push(...notesProblems(value[locale], `${where}.${locale}`));
	}

	const hasAnything = NOTE_GROUPS.some((group) => {
		const fr = value.fr;
		return isRecord(fr) && Array.isArray(fr[group]) && fr[group].length > 0;
	});
	if (problems.length === 0 && !hasAnything) problems.push(`${where}: every group is empty`);

	return problems;
}

/** Every problem with the whole `releases.json` document. Empty means valid. */
export function releasesProblems(value: unknown): string[] {
	if (!Array.isArray(value)) return ['releases: expected an array'];

	const problems: string[] = [];
	const seen = new Set<string>();

	value.forEach((release, index) => {
		const where = `releases[${index}]`;
		if (!isRecord(release)) {
			problems.push(`${where}: expected an object`);
			return;
		}
		for (const key of Object.keys(release)) {
			if (!['version', 'date', 'notes'].includes(key)) problems.push(`${where}: unknown field "${key}"`);
		}

		const { version, date } = release;
		if (typeof version !== 'string' || !VERSION_RE.test(version)) {
			problems.push(`${where}.version: expected major.minor.patch`);
		} else {
			if (seen.has(version)) problems.push(`${where}.version: ${version} appears twice`);
			seen.add(version);

			const previous = value[index - 1];
			if (isRecord(previous) && typeof previous.version === 'string') {
				if (compareVersions(previous.version, version) <= 0) {
					problems.push(`${where}.version: not older than the release before it (newest first)`);
				}
			}
		}
		if (typeof date !== 'string' || !DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
			problems.push(`${where}.date: expected YYYY-MM-DD`);
		}

		problems.push(...releaseNotesProblems(release.notes, `${where}.notes`));
	});

	return problems;
}

/** The releases, validated. Throws with every problem listed at once, so a bad file is fixed in one go. */
export function parseReleases(value: unknown): Release[] {
	const problems = releasesProblems(value);
	if (problems.length > 0) throw new Error(`Invalid releases:\n- ${problems.join('\n- ')}`);
	return value as Release[];
}

/**
 * The notes to show for `locale`: its own, then English, then French.
 *
 * Every committed release carries all ten, the validator sees to it; the chain is for a locale code the
 * app might one day add before the next release catches up, and for the partial entries a test builds.
 */
export function notesFor(release: Release, locale: string): ReleaseNotes {
	const notes = release.notes as Partial<Record<string, ReleaseNotes>>;
	return notes[locale] ?? notes.en ?? notes.fr ?? { new: [], improved: [], fixed: [] };
}

/**
 * Adds `release` at the top, replacing an entry for the same version: re-running the workflow for a
 * version not yet merged rewrites its notes rather than stacking a duplicate. The result stays newest first.
 */
export function addRelease(releases: Release[], release: Release): Release[] {
	return [release, ...releases.filter((existing) => existing.version !== release.version)].sort((a, b) =>
		compareVersions(b.version, a.version)
	);
}

/**
 * Every release after `lastSeen`, oldest first — so a person who missed several releases reads them in
 * the order they happened.
 *
 * An empty `lastSeen` (nobody has ever acknowledged a changelog on this device) returns everything: there
 * is nothing false about telling a brand new account what changed since the beginning.
 */
export function releasesSince(releases: Release[], lastSeen: string): Release[] {
	return releases
		.filter((release) => compareVersions(release.version, lastSeen) > 0)
		.sort((a, b) => compareVersions(a.version, b.version));
}
