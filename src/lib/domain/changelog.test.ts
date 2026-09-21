import { describe, expect, it } from 'vitest';
import { CHANGELOG_ENTRIES, compareVersions, entriesSince } from './changelog';

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

describe('entriesSince', () => {
	it("rend tout depuis une version jamais vue", () => {
		expect(entriesSince('')).toEqual(CHANGELOG_ENTRIES);
	});

	it('ne rend rien pour la version déjà vue', () => {
		expect(entriesSince('0.1.0')).toEqual([]);
	});

	it("ne rend rien pour une version plus récente que ce qui existe", () => {
		expect(entriesSince('9.9.9')).toEqual([]);
	});

	it('trie du plus ancien au plus récent', () => {
		const entries = entriesSince('0.0.0');
		const versions = entries.map((entry) => entry.version);
		const sorted = [...versions].sort((a, b) => compareVersions(a, b));
		expect(versions).toEqual(sorted);
	});
});
