import { describe, expect, it } from 'vitest';
import { householdErrorKey } from './household-error';

describe('householdErrorKey', () => {
	it('reconnaît un code invalide ou expiré', () => {
		expect(householdErrorKey('code invalide ou expire')).toBe('household.errorCode');
	});

	it('reconnaît un foyer qu il faut quitter d abord', () => {
		expect(householdErrorKey('quittez d abord votre foyer actuel')).toBe(
			'household.errorLeaveFirst'
		);
	});

	it('reconnaît le dernier membre qui ne peut pas partir', () => {
		expect(householdErrorKey('un foyer ne peut pas rester sans membre')).toBe(
			'household.errorLastMember'
		);
	});

	it('sépare le compte en attente de la session sans deuxième facteur', () => {
		expect(householdErrorKey('compte non valide', false)).toBe('household.errorNotApproved');
		expect(householdErrorKey('compte non valide', true)).toBe('household.errorSecondFactor');
	});

	it("traite 'aucun foyer' comme un refus d'accès, pas comme un code fautif", () => {
		expect(householdErrorKey('aucun foyer')).toBe('household.errorNotApproved');
	});

	it('retombe sur un texte générique plutôt que de montrer un message de base inconnu', () => {
		expect(householdErrorKey('duplicate key value violates unique constraint')).toBe(
			'household.errorUnknown'
		);
	});
});
