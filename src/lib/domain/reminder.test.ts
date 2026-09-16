import { describe, expect, it } from 'vitest';
import {
	isEventDate,
	reminderAt,
	reminderId,
	reminderPlans,
	reminderStatus,
	REMINDER_HOUR
} from './reminder';

const le = (texte: string) => new Date(texte);

describe('isEventDate', () => {
	it('accepte un jour écrit en ISO', () => {
		expect(isEventDate('2026-02-14')).toBe(true);
		expect(isEventDate('2026-12-31')).toBe(true);
	});

	// Le sondage du chat écrit dans le même champ, et son libellé n'est pas une date ISO.
	it('refuse ce qui n’est pas un jour', () => {
		expect(isEventDate('samedi prochain')).toBe(false);
		expect(isEventDate('14/02/2026')).toBe(false);
		expect(isEventDate('2026-02-14T18:00:00Z')).toBe(false);
		expect(isEventDate('')).toBe(false);
		expect(isEventDate(null)).toBe(false);
		expect(isEventDate(undefined)).toBe(false);
	});

	it('refuse un jour qui n’existe pas', () => {
		expect(isEventDate('2026-02-31')).toBe(false);
		expect(isEventDate('2026-13-01')).toBe(false);
	});

	it('connaît les années bissextiles', () => {
		expect(isEventDate('2028-02-29')).toBe(true);
		expect(isEventDate('2026-02-29')).toBe(false);
	});
});

describe('reminderAt', () => {
	it('tombe la veille au soir', () => {
		const at = reminderAt('2026-02-14', le('2026-02-01T09:00:00'));

		expect(at?.getFullYear()).toBe(2026);
		expect(at?.getMonth()).toBe(1);
		expect(at?.getDate()).toBe(13);
		expect(at?.getHours()).toBe(REMINDER_HOUR);
	});

	it('remonte au mois précédent quand la date est un premier du mois', () => {
		const at = reminderAt('2026-03-01', le('2026-02-01T09:00:00'));

		expect(at?.getMonth()).toBe(1);
		expect(at?.getDate()).toBe(28);
	});

	// Programmer dans le passé ne déclenche rien : autant ne rien rendre et le dire.
	it('ne rend rien quand la veille au soir est passée', () => {
		expect(reminderAt('2026-02-14', le('2026-02-13T19:00:00'))).toBeNull();
		expect(reminderAt('2026-02-14', le('2026-02-14T08:00:00'))).toBeNull();
		expect(reminderAt('2026-02-14', le('2026-03-01T08:00:00'))).toBeNull();
	});

	it('tient encore à quelques minutes près', () => {
		expect(reminderAt('2026-02-14', le('2026-02-13T17:59:00'))).not.toBeNull();
	});

	it('ne rend rien pour une date illisible', () => {
		expect(reminderAt('samedi', le('2026-02-01T09:00:00'))).toBeNull();
		expect(reminderAt(undefined, le('2026-02-01T09:00:00'))).toBeNull();
	});
});

describe('reminderId', () => {
	it('rend le même entier pour la même liste', () => {
		expect(reminderId('a3f1-liste')).toBe(reminderId('a3f1-liste'));
	});

	it('sépare deux listes', () => {
		expect(reminderId('liste-a')).not.toBe(reminderId('liste-b'));
	});

	it('reste un entier positif tenant sur 32 bits', () => {
		for (const id of ['', 'x', crypto.randomUUID(), crypto.randomUUID()]) {
			const numero = reminderId(id);
			expect(Number.isInteger(numero)).toBe(true);
			expect(numero).toBeGreaterThanOrEqual(0);
			expect(numero).toBeLessThan(2147483647);
		}
	});
});

describe('reminderPlans', () => {
	const maintenant = le('2026-02-01T09:00:00');

	const liste = (extra: Partial<Parameters<typeof reminderPlans>[0][number]> = {}) => ({
		listId: 'liste-1',
		name: 'Crêpes',
		eventDate: '2026-02-14',
		total: 3,
		done: 1,
		...extra
	});

	it('retient une liste datée et inachevée', () => {
		const plans = reminderPlans([liste()], maintenant);

		expect(plans).toHaveLength(1);
		expect(plans[0].listId).toBe('liste-1');
		expect(plans[0].name).toBe('Crêpes');
		expect(plans[0].id).toBe(reminderId('liste-1'));
	});

	it('ignore une liste sans date', () => {
		expect(reminderPlans([liste({ eventDate: undefined })], maintenant)).toHaveLength(0);
	});

	it('ignore une date déjà passée', () => {
		expect(reminderPlans([liste()], le('2026-03-01T09:00:00'))).toHaveLength(0);
	});

	it('ignore une liste entièrement cochée', () => {
		expect(reminderPlans([liste({ total: 3, done: 3 })], maintenant)).toHaveLength(0);
	});

	// C'est justement la liste qu'on n'a pas encore remplie qu'il faut rappeler.
	it('garde une liste vide', () => {
		expect(reminderPlans([liste({ total: 0, done: 0 })], maintenant)).toHaveLength(1);
	});

	it('trie rien et garde l’ordre reçu', () => {
		const plans = reminderPlans(
			[liste(), liste({ listId: 'liste-2', name: 'Anniversaire', eventDate: '2026-02-20' })],
			maintenant
		);

		expect(plans.map((plan) => plan.listId)).toEqual(['liste-1', 'liste-2']);
	});
});

describe('reminderStatus', () => {
	const maintenant = le('2026-02-01T09:00:00');

	it('ne dit rien sans date', () => {
		expect(reminderStatus('', maintenant).status).toBe('none');
		expect(reminderStatus(undefined, maintenant).status).toBe('none');
	});

	it('signale une date illisible', () => {
		expect(reminderStatus('samedi', maintenant).status).toBe('invalid');
	});

	it('annonce le rappel quand il partira', () => {
		const { status, at } = reminderStatus('2026-02-14', maintenant);

		expect(status).toBe('planned');
		expect(at?.getDate()).toBe(13);
	});

	// Date encore devant nous, mais veille au soir dépassée : on l'écrit plutôt que de mentir.
	it('avoue qu’il est trop tard pour un rappel', () => {
		expect(reminderStatus('2026-02-14', le('2026-02-13T20:00:00')).status).toBe('late');
		expect(reminderStatus('2026-02-14', le('2026-02-14T08:00:00')).status).toBe('late');
	});
});
