import { describe, expect, it } from 'vitest';
import { localWins, type SyncBookkeeping } from './appearance';

const fresh: SyncBookkeeping = { changedAt: 0, syncedAt: 0, syncedFor: null };

describe('localWins', () => {
	it("laisse la base gagner sur un appareil jamais synchronisé, sans réglage touché", () => {
		expect(localWins(fresh, 'user-a')).toBe(false);
	});

	it("laisse l'appareil gagner quand un réglage a été touché avant tout compte (parcours de bienvenue)", () => {
		const bookkeeping: SyncBookkeeping = { ...fresh, changedAt: 100 };
		expect(localWins(bookkeeping, 'user-a')).toBe(true);
	});

	it('laisse la base gagner pour un même compte sans changement depuis le dernier envoi', () => {
		const bookkeeping: SyncBookkeeping = { changedAt: 100, syncedAt: 100, syncedFor: 'user-a' };
		expect(localWins(bookkeeping, 'user-a')).toBe(false);
	});

	it("laisse l'appareil gagner pour un même compte modifié depuis le dernier envoi (hors ligne)", () => {
		const bookkeeping: SyncBookkeeping = { changedAt: 200, syncedAt: 100, syncedFor: 'user-a' };
		expect(localWins(bookkeeping, 'user-a')).toBe(true);
	});

	it(
		"laisse la base gagner quand la dernière synchronisation appartient à un autre compte, même si " +
			"l'horodatage local est postérieur — l'appareil partagé ne doit jamais imposer le hasSeenTour " +
			"d'un compte précédent au suivant",
		() => {
			const bookkeeping: SyncBookkeeping = { changedAt: 500, syncedAt: 100, syncedFor: 'user-a' };
			expect(localWins(bookkeeping, 'user-b')).toBe(false);
		}
	);

	it(
		"un appareil partagé remis à zéro (forgetAccount après une déconnexion) retombe sur la base pour " +
			'le compte suivant, au lieu de garder le hasSeenTour du précédent',
		() => {
			// This is the state `Settings#forgetAccount` restores on sign-out: no account owns the bookkeeping
			// any more, and nothing has been touched since, so the very next sign-in defers to the server
			// instead of reusing whatever the last account left behind.
			expect(localWins(fresh, 'user-b')).toBe(false);
		}
	);
});
