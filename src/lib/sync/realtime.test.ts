import { describe, expect, it } from 'vitest';
import { planRealtime, rowKey, type RealtimeContext, type RealtimeEvent } from './realtime';
import { toItem, toMessage } from './mapping';

const LIST = '11111111-1111-1111-1111-111111111111';
const ITEM = '22222222-2222-2222-2222-222222222222';

const itemRow = (extra: Record<string, unknown> = {}) => ({
	id: ITEM,
	list_id: LIST,
	aisle_id: '',
	name: 'Lait',
	qty: 2,
	unit: 'L',
	checked: false,
	priority: false,
	note: null,
	assigned_to: null,
	created_at: '2026-09-16T10:00:00.000Z',
	...extra
});

const context = (extra: Partial<RealtimeContext> = {}): RealtimeContext => ({
	knownListIds: new Set([LIST]),
	applied: new Map(),
	busy: false,
	...extra
});

const event = (extra: Partial<RealtimeEvent> = {}): RealtimeEvent => ({
	table: 'items',
	eventType: 'INSERT',
	commitTimestamp: '2026-09-16T10:00:00.000Z',
	new: itemRow(),
	...extra
});

describe('planRealtime', () => {
	it('pose un article inséré', () => {
		expect(planRealtime(event(), context())).toEqual({
			kind: 'put',
			table: 'items',
			row: toItem(itemRow())
		});
	});

	it('pose un message inséré', () => {
		const row = {
			id: ITEM,
			list_id: LIST,
			user_id: 'moi',
			body: 'à tout de suite',
			is_system: false,
			created_at: '2026-09-16T10:00:00.000Z'
		};

		expect(
			planRealtime(event({ table: 'messages', new: row }), context())
		).toEqual({ kind: 'put', table: 'messages', row: toMessage(row) });
	});

	// Le contrat central : ce que la voie rapide écrit doit être exactement ce que la relecture
	// écrirait. Une divergence ici ne se verrait qu'à la prochaine relecture, des jours plus tard.
	it('produit la même ligne que la couche de traduction', () => {
		const row = itemRow({ qty: '1.5', checked: true, note: 'bio' });
		const plan = planRealtime(event({ eventType: 'UPDATE', new: row }), context());

		expect(plan).toEqual({ kind: 'put', table: 'items', row: toItem(row) });
	});

	it('supprime depuis la clé primaire seule, tout ce que porte un DELETE', () => {
		expect(
			planRealtime(event({ eventType: 'DELETE', new: {}, old: { id: ITEM } }), context())
		).toEqual({ kind: 'delete', table: 'items', id: ITEM });
	});

	it('supprime même une ligne dont la liste est inconnue', () => {
		const plan = planRealtime(
			event({ eventType: 'DELETE', new: {}, old: { id: ITEM } }),
			context({ knownListIds: new Set() })
		);

		expect(plan).toEqual({ kind: 'delete', table: 'items', id: ITEM });
	});

	it('écarte un évènement plus ancien que ce qui est déjà appliqué', () => {
		const applied = new Map([[rowKey('items', ITEM), '2026-09-16T10:00:05.000Z']]);

		expect(
			planRealtime(event({ commitTimestamp: '2026-09-16T10:00:04.000Z' }), context({ applied }))
		).toEqual({ kind: 'skip' });
	});

	it('ne ressuscite pas une ligne supprimée avec une mise à jour retardataire', () => {
		const applied = new Map([[rowKey('items', ITEM), '2026-09-16T10:00:05.000Z']]);

		const plan = planRealtime(
			event({ eventType: 'UPDATE', commitTimestamp: '2026-09-16T10:00:01.000Z' }),
			context({ applied })
		);

		expect(plan).toEqual({ kind: 'skip' });
	});

	it('accepte un évènement plus récent que le dernier appliqué', () => {
		const applied = new Map([[rowKey('items', ITEM), '2026-09-16T10:00:00.000Z']]);

		expect(
			planRealtime(
				event({ eventType: 'UPDATE', commitTimestamp: '2026-09-16T10:00:01.000Z' }),
				context({ applied })
			).kind
		).toBe('put');
	});

	it('accepte un évènement du même commit', () => {
		const applied = new Map([[rowKey('items', ITEM), '2026-09-16T10:00:00.000Z']]);

		expect(planRealtime(event(), context({ applied })).kind).toBe('put');
	});

	it('ne confond pas deux tables portant le même identifiant', () => {
		const applied = new Map([[rowKey('messages', ITEM), '2026-09-16T11:00:00.000Z']]);

		expect(planRealtime(event(), context({ applied })).kind).toBe('put');
	});

	describe('retombe sur la relecture complète', () => {
		it('quand une écriture locale attend ou qu une relecture est en vol', () => {
			expect(planRealtime(event(), context({ busy: true }))).toEqual({ kind: 'pull' });
		});

		it('quand la table ne se reconstruit pas depuis son payload', () => {
			for (const table of [
				'lists',
				'list_members',
				'polls',
				'poll_options',
				'poll_votes',
				'item_prices',
				'recipes',
				'recipe_ingredients',
				'recipe_steps',
				'shops',
				'admin_notifications'
			]) {
				expect(planRealtime(event({ table }), context())).toEqual({ kind: 'pull' });
			}
		});

		it('quand la liste visée est absente du cache', () => {
			expect(planRealtime(event(), context({ knownListIds: new Set() }))).toEqual({
				kind: 'pull'
			});
		});

		it('quand l identifiant manque ou n est pas une chaîne', () => {
			expect(planRealtime(event({ new: itemRow({ id: undefined }) }), context())).toEqual({
				kind: 'pull'
			});
			expect(planRealtime(event({ new: itemRow({ id: '' }) }), context())).toEqual({
				kind: 'pull'
			});
			expect(planRealtime(event({ new: itemRow({ id: 42 }) }), context())).toEqual({
				kind: 'pull'
			});
		});

		it('quand un DELETE arrive sans clé primaire', () => {
			expect(
				planRealtime(event({ eventType: 'DELETE', old: {}, new: {} }), context())
			).toEqual({ kind: 'pull' });
		});

		it('quand l horodatage de commit est illisible', () => {
			expect(planRealtime(event({ commitTimestamp: '' }), context())).toEqual({ kind: 'pull' });
			expect(planRealtime(event({ commitTimestamp: 'jamais' }), context())).toEqual({
				kind: 'pull'
			});
		});

		it('quand le type d évènement est inattendu', () => {
			expect(planRealtime(event({ eventType: 'TRUNCATE' }), context())).toEqual({
				kind: 'pull'
			});
		});

		it('quand la ligne est absente d un INSERT', () => {
			expect(planRealtime(event({ new: undefined }), context())).toEqual({ kind: 'pull' });
		});

		it('quand la liste visée n est pas une chaîne', () => {
			expect(planRealtime(event({ new: itemRow({ list_id: null }) }), context())).toEqual({
				kind: 'pull'
			});
		});
	});

	// Le cas qui a motivé la pierre tombale : suppression puis recréation du même identifiant.
	it('réapplique une insertion postérieure à une suppression', () => {
		const applied = new Map([[rowKey('items', ITEM), '2026-09-16T10:00:05.000Z']]);

		expect(
			planRealtime(
				event({ eventType: 'INSERT', commitTimestamp: '2026-09-16T10:00:06.000Z' }),
				context({ applied })
			).kind
		).toBe('put');
	});
});
