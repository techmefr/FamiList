import { describe, expect, it } from 'vitest';
import { deleteAccountErrorKey, exportFileName, matchesConfirmation } from './account-data';

describe('matchesConfirmation', () => {
	it('accepte l adresse exacte', () => {
		expect(matchesConfirmation('alice@exemple.fr', 'alice@exemple.fr')).toBe(true);
	});

	it('tolère la casse et les espaces ajoutés par un clavier de téléphone', () => {
		expect(matchesConfirmation('  Alice@Exemple.FR ', 'alice@exemple.fr')).toBe(true);
	});

	it('refuse une adresse approchante', () => {
		expect(matchesConfirmation('alice@exemple.com', 'alice@exemple.fr')).toBe(false);
	});

	it('refuse une saisie vide, même face à un compte sans adresse connue', () => {
		expect(matchesConfirmation('', 'alice@exemple.fr')).toBe(false);
		expect(matchesConfirmation('', null)).toBe(false);
		expect(matchesConfirmation('   ', '   ')).toBe(false);
	});
});

describe('deleteAccountErrorKey', () => {
	it('reconnaît le dernier administrateur', () => {
		expect(deleteAccountErrorKey('nommez un autre administrateur avant de partir')).toBe(
			'security.deleteErrorLastAdmin'
		);
	});

	it('reconnaît le compte de démonstration', () => {
		expect(deleteAccountErrorKey('le compte de demonstration ne se supprime pas')).toBe(
			'security.deleteErrorDemo'
		);
	});

	it('reconnaît la session restée au mot de passe', () => {
		expect(deleteAccountErrorKey('deuxieme facteur requis')).toBe(
			'security.deleteErrorSecondFactor'
		);
	});

	it('retombe sur un texte générique plutôt que sur un message de base', () => {
		expect(deleteAccountErrorKey('update or delete on table violates foreign key')).toBe(
			'security.deleteErrorUnknown'
		);
	});
});

describe('exportFileName', () => {
	it('date le fichier au jour près, avec des mois et des jours sur deux chiffres', () => {
		expect(exportFileName(new Date(2026, 8, 7))).toBe('familiste-mes-donnees-2026-09-07.json');
		expect(exportFileName(new Date(2026, 11, 25))).toBe('familiste-mes-donnees-2026-12-25.json');
	});
});
