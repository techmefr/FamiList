import { describe, expect, it } from 'vitest';
import pkg from '../../../package.json';
import data from './releases.json';
import { releasesProblems } from '../domain/changelog';

describe('releases.json', () => {
	it('respecte le format strict, dans les dix langues', () => {
		expect(releasesProblems(data)).toEqual([]);
	});

	it("commence par la version de package.json, pour que l'écran « Quoi de neuf » la décrive", () => {
		expect(data[0]?.version).toBe(pkg.version);
	});
});
