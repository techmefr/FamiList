import { describe, expect, it } from 'vitest';
import { directSummaries, otherParticipant } from './direct-conversation';

const conversation = (id: string, participantIds: string[]) => ({ id, participantIds });

describe('otherParticipant', () => {
	it('désigne la personne en face', () => {
		expect(otherParticipant(conversation('c1', ['moi', 'toi']), 'moi')).toBe('toi');
	});

	it('ne se désigne jamais soi-même', () => {
		expect(otherParticipant(conversation('c1', ['moi']), 'moi')).toBeUndefined();
	});
});

describe('directSummaries', () => {
	it('résume une conversation par son dernier message', () => {
		const resume = directSummaries(
			[conversation('c1', ['moi', 'toi'])],
			[
				{ conversationId: 'c1', body: 'salut', createdAt: 10 },
				{ conversationId: 'c1', body: 'à demain', createdAt: 20 }
			],
			'moi'
		);

		expect(resume).toEqual([
			{ conversationId: 'c1', otherId: 'toi', lastBody: 'à demain', lastAt: 20 }
		]);
	});

	it('met la conversation la plus récente en tête', () => {
		const resume = directSummaries(
			[conversation('c1', ['moi', 'toi']), conversation('c2', ['moi', 'elle'])],
			[
				{ conversationId: 'c1', body: 'vieux', createdAt: 5 },
				{ conversationId: 'c2', body: 'récent', createdAt: 50 }
			],
			'moi'
		);

		expect(resume.map((r) => r.conversationId)).toEqual(['c2', 'c1']);
	});

	it('garde une conversation qui n’a encore aucun message', () => {
		const resume = directSummaries([conversation('c1', ['moi', 'toi'])], [], 'moi');

		expect(resume).toEqual([{ conversationId: 'c1', otherId: 'toi', lastBody: '', lastAt: 0 }]);
	});

	it('ignore les messages de liste', () => {
		const resume = directSummaries(
			[conversation('c1', ['moi', 'toi'])],
			[{ body: 'pain', createdAt: 99 }],
			'moi'
		);

		expect(resume[0]!.lastBody).toBe('');
	});

	it('écarte une conversation dont l’autre a disparu', () => {
		expect(directSummaries([conversation('c1', ['moi'])], [], 'moi')).toEqual([]);
	});
});
