import { describe, expect, it } from 'vitest';
import type { OutboxEntry } from '$db/schema';
import {
	protectedRows,
	rejectedEntity,
	rejectionKey,
	restorePlan,
	retryEntry,
	toRejection
} from './rejections';

const card: OutboxEntry = {
	seq: 7,
	table: 'loyalty_cards',
	op: 'upsert',
	match: { id: 'c1' },
	payload: { id: 'c1', code_type: 'ean13' }
};

const AT = '2026-09-24T10:00:00.000Z';

describe('rejectionKey', () => {
	it('ne dépend pas de l ordre des champs de la clé', () => {
		expect(rejectionKey({ table: 'poll_votes', match: { user_id: 'u', option_id: 'o' } })).toBe(
			rejectionKey({ table: 'poll_votes', match: { option_id: 'o', user_id: 'u' } })
		);
	});

	it('distingue deux tables pour le même id', () => {
		expect(rejectionKey({ table: 'items', match: { id: 'x' } })).not.toBe(
			rejectionKey({ table: 'lists', match: { id: 'x' } })
		);
	});
});

describe('toRejection', () => {
	it('garde table, id, code et horodatage', () => {
		expect(toRejection(card, { code: '23514', message: 'check violated' }, AT)).toEqual({
			key: rejectionKey(card),
			table: 'loyalty_cards',
			op: 'upsert',
			match: { id: 'c1' },
			payload: card.payload,
			code: '23514',
			message: 'check violated',
			at: AT
		});
	});
});

describe('retryEntry', () => {
	it('rend l écriture d origine sans numéro de file', () => {
		const entry = retryEntry(toRejection(card, { code: '42703' }, AT));
		expect(entry).toEqual({
			table: 'loyalty_cards',
			op: 'upsert',
			match: { id: 'c1' },
			payload: card.payload
		});
	});
});

describe('rejectedEntity', () => {
	it('nomme une carte refusée', () => {
		expect(rejectedEntity({ table: 'loyalty_cards' })).toBe('card');
	});

	it('retombe sur other pour une table inconnue', () => {
		expect(rejectedEntity({ table: 'household_members' })).toBe('other');
	});
});

describe('protectedRows', () => {
	it('traduit la table serveur en table locale et en clé Dexie', () => {
		const rows = protectedRows([
			toRejection(card, { code: '23514' }, AT),
			toRejection(
				{
					table: 'shop_item_orders',
					op: 'upsert',
					match: { shop_id: 's', user_id: 'u', aisle_id: 'a' }
				},
				{ code: '42501' },
				AT
			)
		]);

		expect(rows).toEqual([
			{ dexie: 'cards', key: 'c1', op: 'upsert' },
			{ dexie: 'shopItemOrders', key: 's::a', op: 'upsert' }
		]);
	});

	it('ignore une table sans pendant local', () => {
		const rejection = toRejection(
			{ table: 'list_members', op: 'upsert', match: { list_id: 'l', user_id: 'u' } },
			{ code: '42501' },
			AT
		);
		expect(protectedRows([rejection])).toEqual([]);
	});

	it('ignore une clé incomplète', () => {
		const rejection = toRejection(
			{ table: 'poll_votes', op: 'delete', match: { option_id: 'o' } },
			{ code: '42501' },
			AT
		);
		expect(protectedRows([rejection])).toEqual([]);
	});
});

describe('restorePlan', () => {
	it('remet la version locale d une écriture refusée par dessus le serveur', () => {
		const local = { id: 'c1', name: 'Carte' };
		expect(
			restorePlan([{ dexie: 'cards', key: 'c1', op: 'upsert' }], () => local)
		).toEqual([{ kind: 'put', dexie: 'cards', row: local }]);
	});

	it('garde supprimé ce que le serveur a refusé de supprimer', () => {
		expect(restorePlan([{ dexie: 'items', key: 'i1', op: 'delete' }], () => undefined)).toEqual([
			{ kind: 'delete', dexie: 'items', key: 'i1' }
		]);
	});

	it('ne réinvente pas une ligne absente du cache local', () => {
		expect(restorePlan([{ dexie: 'cards', key: 'c1', op: 'upsert' }], () => undefined)).toEqual(
			[]
		);
	});
});
