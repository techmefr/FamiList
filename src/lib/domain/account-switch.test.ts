import { describe, expect, it } from 'vitest';
import { accountDecision } from './account-switch';

describe('accountDecision', () => {
	it('ignore une reponse en erreur, meme si elle arrive vide', () => {
		expect(accountDecision({ id: 'anna', known: true }, { id: '', failed: true })).toBe('ignore');
	});

	it('ignore une reponse en erreur qui porte pourtant un autre compte', () => {
		expect(accountDecision({ id: 'anna', known: true }, { id: 'bob', failed: true })).toBe('ignore');
	});

	it('ne fait rien tant que le compte est le meme', () => {
		expect(accountDecision({ id: 'anna', known: true }, { id: 'anna', failed: false })).toBe(
			'ignore'
		);
	});

	it('repart de zero sur un vrai changement de compte', () => {
		expect(accountDecision({ id: 'anna', known: true }, { id: 'bob', failed: false })).toBe(
			'reload'
		);
	});

	it('repart de zero a la deconnexion, le serveur ne renvoyant plus de compte', () => {
		expect(accountDecision({ id: 'anna', known: true }, { id: '', failed: false })).toBe('reload');
	});

	it('retient la premiere identite connue sans rien vider', () => {
		expect(accountDecision({ id: '', known: false }, { id: 'anna', failed: false })).toBe(
			'remember'
		);
	});
});
