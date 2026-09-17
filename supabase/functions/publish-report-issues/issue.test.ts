import { describe, expect, it } from 'vitest';
import { buildIssue } from './issue.ts';

describe('buildIssue', () => {
	it('met le numero dans le titre', () => {
		expect(buildIssue({ id: 'a', number: 42, kind: 'bug' }).title).toBe(
			'Report 42 — triage in /admin'
		);
	});

	it('nomme une suggestion autrement', () => {
		const issue = buildIssue({ id: 'a', number: 7, kind: 'suggestion' });

		expect(issue.title).toBe('Suggestion 7 — triage in /admin');
		expect(issue.labels).toEqual(['enhancement']);
	});

	it('etiquette un bug', () => {
		expect(buildIssue({ id: 'a', number: 1, kind: 'bug' }).labels).toEqual(['bug']);
	});

	it('retombe sur bug pour une sorte inconnue', () => {
		expect(buildIssue({ id: 'a', number: 1, kind: 'autre' }).labels).toEqual(['bug']);
	});

	// The test that counts: the repository is public, and nothing from the report must leave. We put in here
	// content resembling what a report really carries, and check that none of its traces appears in what
	// leaves.
	it('ne publie que le numero, jamais le contenu du signalement', () => {
		const issue = buildIssue({ id: 'e1f2-3456', number: 42, kind: 'bug' });
		const publie = `${issue.title}\n${issue.body}`;

		for (const secret of ['e1f2-3456', 'Camille', 'data:image/jpeg', '/lists/8f']) {
			expect(publie).not.toContain(secret);
		}
	});
});
