import { describe, expect, it } from 'vitest';
import { adminErrorKey, needsElevation } from './admin-error';

describe('adminErrorKey', () => {
	it('sépare le rôle manquant de la session non élevée', () => {
		expect(adminErrorKey('reserve aux administrateurs')).toBe('admin.errorDenied');
		expect(adminErrorKey('elevation requise')).toBe('admin.errorSecondFactor');
	});

	it('laisse passer les refus précis, qui en disent plus que ne le ferait une traduction', () => {
		expect(adminErrorKey('il doit rester au moins un administrateur')).toBeNull();
		expect(adminErrorKey('le compte doit etre valide avant d etre promu')).toBeNull();
	});
});

describe('needsElevation', () => {
	it("ne propose la sortie que lorsque c'est bien le deuxième facteur qui manque", () => {
		expect(needsElevation(['elevation requise'])).toBe(true);
		expect(needsElevation(['reserve aux administrateurs'])).toBe(false);
		expect(needsElevation([])).toBe(false);
	});

	// Les deux lectures du panneau échouent indépendamment : une seule des deux causes suffit.
	it('trouve la cause même noyée parmi plusieurs refus', () => {
		expect(needsElevation(['aucun compte de demonstration', 'elevation requise'])).toBe(true);
	});
});
