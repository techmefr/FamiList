import { describe, expect, it } from 'vitest';
import {
	RELEASE_LOCALES,
	addRelease,
	compareVersions,
	notesFor,
	parseReleases,
	releaseNotesProblems,
	releasesProblems,
	releasesSince,
	type Release,
	type ReleaseNotes
} from './changelog';

const notes = (label: string): ReleaseNotes => ({ new: [`${label} new`], improved: [], fixed: [`${label} fixed`] });

const release = (version: string, date = '2026-09-25'): Release => ({
	version,
	date,
	notes: Object.fromEntries(RELEASE_LOCALES.map((locale) => [locale, notes(`${locale} ${version}`)])) as Release['notes']
});

describe('compareVersions', () => {
	it('reconnaît deux versions égales', () => {
		expect(compareVersions('0.1.0', '0.1.0')).toBe(0);
	});

	it('compare le majeur en premier', () => {
		expect(compareVersions('1.0.0', '0.9.9')).toBeGreaterThan(0);
	});

	it('compare le mineur quand le majeur est égal', () => {
		expect(compareVersions('0.2.0', '0.10.0')).toBeLessThan(0);
	});

	it('compare le patch en dernier recours', () => {
		expect(compareVersions('0.1.2', '0.1.10')).toBeLessThan(0);
	});

	it('traite une chaîne vide comme 0.0.0', () => {
		expect(compareVersions('0.0.1', '')).toBeGreaterThan(0);
		expect(compareVersions('', '')).toBe(0);
	});
});

describe('releaseNotesProblems', () => {
	it('accepte les dix langues avec leurs trois groupes', () => {
		expect(releaseNotesProblems(release('0.1.1').notes)).toEqual([]);
	});

	it('signale chaque langue manquante', () => {
		const { mg: _mg, ar: _ar, ...partial } = release('0.1.1').notes;
		expect(releaseNotesProblems(partial)).toEqual(['notes.ar: missing', 'notes.mg: missing']);
	});

	it('refuse une langue ou un groupe inconnu', () => {
		const value = { ...release('0.1.1').notes, 'pt-BR': notes('x') } as Record<string, unknown>;
		value.fr = { ...notes('fr'), fixes: [] };
		expect(releaseNotesProblems(value)).toEqual(['notes: unknown locale "pt-BR"', 'notes.fr: unknown group "fixes"']);
	});

	it('refuse un groupe absent, une note vide ou trop longue', () => {
		const value = release('0.1.1').notes as Record<string, unknown>;
		value.en = { new: ['', 'x'.repeat(281)], improved: [] };
		expect(releaseNotesProblems(value)).toEqual([
			'notes.en.new[0]: expected a non-empty string',
			'notes.en.new[1]: longer than 280 characters',
			'notes.en.fixed: expected an array'
		]);
	});

	it('refuse une version sans aucune note', () => {
		const empty = Object.fromEntries(RELEASE_LOCALES.map((locale) => [locale, { new: [], improved: [], fixed: [] }]));
		expect(releaseNotesProblems(empty)).toEqual(['notes: every group is empty']);
	});

	it("refuse ce qui n'est pas un objet", () => {
		expect(releaseNotesProblems(null)).toEqual(['notes: expected an object keyed by locale']);
		expect(releaseNotesProblems({ ...release('0.1.1').notes, fr: [] })).toEqual([
			'notes.fr: expected an object with new, improved and fixed'
		]);
	});
});

describe('releasesProblems', () => {
	it('accepte une liste triée du plus récent au plus ancien', () => {
		expect(releasesProblems([release('0.2.0'), release('0.1.1'), release('0.1.0')])).toEqual([]);
	});

	it('refuse une liste dans le désordre ou avec un doublon', () => {
		expect(releasesProblems([release('0.1.0'), release('0.1.1')])).toEqual([
			'releases[1].version: not older than the release before it (newest first)'
		]);
		expect(releasesProblems([release('0.1.1'), release('0.1.1')])).toContain(
			'releases[1].version: 0.1.1 appears twice'
		);
	});

	it('refuse une version, une date ou un champ mal formés', () => {
		const bad = { ...release('v1'), date: '25/09/2026', extra: true };
		expect(releasesProblems([bad])).toEqual([
			'releases[0]: unknown field "extra"',
			'releases[0].version: expected major.minor.patch',
			'releases[0].date: expected YYYY-MM-DD'
		]);
	});

	it("refuse ce qui n'est pas une liste d'objets", () => {
		expect(releasesProblems({})).toEqual(['releases: expected an array']);
		expect(releasesProblems([42])).toEqual(['releases[0]: expected an object']);
	});
});

describe('parseReleases', () => {
	it('rend les versions valides telles quelles', () => {
		const releases = [release('0.1.1')];
		expect(parseReleases(releases)).toBe(releases);
	});

	it('lève une erreur listant tous les problèmes', () => {
		expect(() => parseReleases([{ version: 'x', date: 'y', notes: {} }])).toThrow(
			/version: expected major\.minor\.patch[\s\S]*date: expected YYYY-MM-DD[\s\S]*notes\.fr: missing/
		);
	});
});

describe('notesFor', () => {
	it('rend les notes de la langue demandée', () => {
		expect(notesFor(release('0.1.1'), 'de')).toEqual(notes('de 0.1.1'));
	});

	it("se rabat sur l'anglais, puis sur le français", () => {
		const onlyEnFr = { ...release('0.1.1'), notes: { en: notes('en'), fr: notes('fr') } } as unknown as Release;
		expect(notesFor(onlyEnFr, 'ar')).toEqual(notes('en'));

		const onlyFr = { ...release('0.1.1'), notes: { fr: notes('fr') } } as unknown as Release;
		expect(notesFor(onlyFr, 'zh')).toEqual(notes('fr'));
	});

	it('rend des groupes vides quand il ne reste rien', () => {
		const none = { ...release('0.1.1'), notes: {} } as unknown as Release;
		expect(notesFor(none, 'fr')).toEqual({ new: [], improved: [], fixed: [] });
	});
});

describe('addRelease', () => {
	it('ajoute en tête et garde les anciennes versions', () => {
		const result = addRelease([release('0.1.0')], release('0.1.1'));
		expect(result.map((entry) => entry.version)).toEqual(['0.1.1', '0.1.0']);
	});

	it('remplace une version déjà présente au lieu de la doubler', () => {
		const rewritten = release('0.1.1', '2026-09-26');
		const result = addRelease([release('0.1.1'), release('0.1.0')], rewritten);
		expect(result).toHaveLength(2);
		expect(result[0]).toBe(rewritten);
	});
});

describe('releasesSince', () => {
	const releases = [release('0.2.0'), release('0.1.1'), release('0.1.0')];

	it('rend tout depuis une version jamais vue, du plus ancien au plus récent', () => {
		expect(releasesSince(releases, '').map((entry) => entry.version)).toEqual(['0.1.0', '0.1.1', '0.2.0']);
	});

	it('ne rend que ce qui est plus récent que la version vue', () => {
		expect(releasesSince(releases, '0.1.1').map((entry) => entry.version)).toEqual(['0.2.0']);
	});

	it('ne rend rien pour la dernière version ou une version plus récente', () => {
		expect(releasesSince(releases, '0.2.0')).toEqual([]);
		expect(releasesSince(releases, '9.9.9')).toEqual([]);
	});
});
