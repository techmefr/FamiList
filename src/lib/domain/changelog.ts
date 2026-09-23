/**
 * What each release brought, and how to tell "seen" from "not seen".
 *
 * The actual prose lives in `changelog.<key>.items` in every locale file, same convention as `tour.*`: this
 * module only lists which versions exist and in which order. A future release adds one entry here and its
 * translations in the ten locale files, nothing else.
 */
export interface ChangelogEntry {
	/** `major.minor.patch`, matching `package.json`'s `version` at the time of release. */
	version: string;
	/** The root of `changelog.<key>.items` in the locale files. */
	key: string;
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [{ version: '0.1.0', key: 'v0_1_0' }];

/**
 * Compares two `major.minor.patch` strings. Negative when `a` is older than `b`, positive when newer, zero
 * when equal.
 *
 * No semver library: the project has none as a dependency, and every version here is written by hand in
 * `package.json` and in this file, so the three-number shape can be trusted without a parser built to
 * tolerate the wider spec (pre-releases, build metadata, partial versions).
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

/**
 * Every entry released after `lastSeen`, oldest first — so a person who missed several releases reads them
 * in the order they happened.
 *
 * An empty `lastSeen` (nobody has ever acknowledged a changelog on this account) returns everything: there
 * is nothing false about telling a brand new account what changed since the beginning, and it keeps this
 * function from needing a special case.
 */
export function entriesSince(lastSeen: string): ChangelogEntry[] {
	return CHANGELOG_ENTRIES.filter((entry) => compareVersions(entry.version, lastSeen) > 0).sort((a, b) =>
		compareVersions(a.version, b.version)
	);
}
