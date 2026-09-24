import { describe, expect, it } from 'vitest';
import {
	accountRevealGate,
	canDecide,
	canRequest,
	decide,
	shareStatusOf,
	toCardShareStatus,
	visibleCards
} from './card-share';

const cards = [
	{ id: 'own', householdId: 'family' },
	{ id: 'accepted', householdId: 'work' },
	{ id: 'pending', householdId: 'work' },
	{ id: 'declined', householdId: 'work' }
];

const shares = [
	{ cardId: 'accepted', householdId: 'family', status: 'accepted' as const },
	{ cardId: 'pending', householdId: 'family', status: 'pending' as const },
	{ cardId: 'declined', householdId: 'family', status: 'declined' as const }
];

describe('toCardShareStatus', () => {
	it('garde un statut connu', () => {
		expect(toCardShareStatus('accepted')).toBe('accepted');
		expect(toCardShareStatus('declined')).toBe('declined');
	});

	it('retombe sur pending pour une valeur inconnue, qui n’ouvre rien', () => {
		expect(toCardShareStatus('granted')).toBe('pending');
		expect(toCardShareStatus(undefined)).toBe('pending');
	});
});

describe('decide', () => {
	it('passe une demande en attente à acceptée ou refusée', () => {
		expect(decide('pending', 'accepted')).toBe('accepted');
		expect(decide('pending', 'declined')).toBe('declined');
	});

	it('ne revient pas sur une décision déjà prise', () => {
		expect(decide('declined', 'accepted')).toBe('declined');
		expect(decide('accepted', 'declined')).toBe('accepted');
		expect(canDecide('accepted')).toBe(false);
	});
});

describe('canRequest', () => {
	it('autorise une première demande et une nouvelle après refus', () => {
		expect(canRequest('none')).toBe(true);
		expect(canRequest('declined')).toBe(true);
	});

	it('ne redemande pas ce qui attend ou est déjà accepté', () => {
		expect(canRequest('pending')).toBe(false);
		expect(canRequest('accepted')).toBe(false);
	});
});

describe('shareStatusOf', () => {
	it('lit le statut du couple carte / cercle', () => {
		expect(shareStatusOf(shares, 'pending', 'family')).toBe('pending');
		expect(shareStatusOf(shares, 'own', 'work')).toBe('none');
	});
});

describe('visibleCards', () => {
	it('montre les cartes du cercle et celles dont le partage est accepté', () => {
		expect(visibleCards(cards, shares, 'family').map((card) => card.id)).toEqual(['own', 'accepted']);
	});

	it('ne montre ni une demande en attente ni une demande refusée', () => {
		const ids = visibleCards(cards, shares, 'family').map((card) => card.id);
		expect(ids).not.toContain('pending');
		expect(ids).not.toContain('declined');
	});

	it('ne montre rien sans cercle actif', () => {
		expect(visibleCards(cards, shares, '')).toEqual([]);
	});
});

describe('accountRevealGate', () => {
	it('laisse passer une session aal2', () => {
		expect(accountRevealGate('aal2', 'aal2')).toBe('allowed');
	});

	it('demande le deuxième facteur quand le compte en a un', () => {
		expect(accountRevealGate('aal1', 'aal2')).toBe('second-factor');
	});

	it('demande d’activer la double authentification quand le compte n’en a pas', () => {
		expect(accountRevealGate('aal1', 'aal1')).toBe('enrol');
		expect(accountRevealGate(null, null)).toBe('enrol');
	});
});
