import { describe, expect, it } from 'vitest';
import {
	fromAisle,
	fromCard,
	fromItem,
	fromItemOrder,
	fromLayout,
	fromList,
	fromMessage,
	fromPoll,
	fromPollOption,
	fromShop,
	toAisle,
	toCard,
	toItem,
	toItemOrder,
	toLayout,
	toList,
	toMember,
	toMessage,
	toPoll,
	toPollOption,
	toPollVote,
	toShop
} from './mapping';

describe('toShop / fromShop', () => {
	it('lit une ligne complète', () => {
		expect(
			toShop({
				id: 's1',
				name: 'Carrefour',
				short: 'CRF',
				tint: 'blue',
				brand: 'Carrefour',
				address: '1 rue de Paris',
				lat: 48.8,
				lng: 2.3,
				is_default: true
			})
		).toEqual({
			id: 's1',
			name: 'Carrefour',
			short: 'CRF',
			tint: 'blue',
			brand: 'Carrefour',
			address: '1 rue de Paris',
			lat: 48.8,
			lng: 2.3,
			isDefault: true
		});
	});

	it('applique les valeurs par défaut sur une ligne vide', () => {
		const shop = toShop({});
		expect(shop.name).toBe('');
		expect(shop.lat).toBeUndefined();
		expect(shop.isDefault).toBe(false);
	});

	it("n'accepte pas des coordonnées qui ne sont pas des nombres", () => {
		expect(toShop({ lat: '48.8', lng: null }).lat).toBeUndefined();
	});

	it('fait l’aller-retour vers les colonnes Postgres', () => {
		const shop = toShop({ id: 's1', name: 'Carrefour', is_default: true, lat: 48.8 });
		expect(fromShop(shop, 'h1')).toEqual({
			id: 's1',
			household_id: 'h1',
			name: 'Carrefour',
			short: '',
			tint: shop.tint,
			brand: '',
			address: '',
			lat: 48.8,
			lng: null,
			is_default: true
		});
	});

	it('écrit null pour des coordonnées absentes', () => {
		expect(fromShop(toShop({}), 'h1').lat).toBeNull();
		expect(fromShop(toShop({}), 'h1').lng).toBeNull();
	});
});

describe('toAisle / fromAisle', () => {
	it('lit une ligne complète', () => {
		expect(toAisle({ id: 'a1', name: 'Fruits', emoji: '🍎', position: 2, kind: 'produce' })).toEqual(
			{ id: 'a1', name: 'Fruits', emoji: '🍎', position: 2, kind: 'produce' }
		);
	});

	it("retombe sur le caddie et la position zéro par défaut", () => {
		const aisle = toAisle({ id: 'a1', name: 'Fruits' });
		expect(aisle.emoji).toBe('🛒');
		expect(aisle.position).toBe(0);
		expect(aisle.kind).toBeUndefined();
	});

	it('écrit null quand kind est absent', () => {
		expect(fromAisle(toAisle({ id: 'a1', name: 'Fruits' }), 'h1').kind).toBeNull();
	});
});

describe('toList / fromList', () => {
	it('associe les membres passés en paramètre', () => {
		const list = toList({ id: 'l1', name: 'Courses', event_date: '2026-12-24' }, ['u1', 'u2']);
		expect(list.memberIds).toEqual(['u1', 'u2']);
		expect(list.eventDate).toBe('2026-12-24');
	});

	it("laisse eventDate absent si la colonne n'est pas une chaîne", () => {
		expect(toList({ id: 'l1', event_date: null }, []).eventDate).toBeUndefined();
	});

	it('écrit null pour une liste sans date', () => {
		expect(fromList(toList({ id: 'l1' }, []), 'h1').event_date).toBeNull();
	});
});

describe('toItem / fromItem', () => {
	it('lit une ligne complète', () => {
		const item = toItem({
			id: 'i1',
			list_id: 'l1',
			aisle_id: 'a1',
			name: 'Pommes',
			qty: 6,
			unit: 'piece',
			checked: true,
			priority: true,
			note: 'bio',
			assigned_to: 'u1',
			created_at: '2026-01-01T00:00:00Z'
		});
		expect(item).toEqual({
			id: 'i1',
			listId: 'l1',
			aisleId: 'a1',
			name: 'Pommes',
			qty: '6',
			unit: 'piece',
			checked: true,
			priority: true,
			note: 'bio',
			assignedTo: 'u1',
			createdAt: Date.parse('2026-01-01T00:00:00Z')
		});
	});

	it('rend une quantité vide quand la colonne est null ou absente', () => {
		expect(toItem({ id: 'i1', qty: null }).qty).toBe('');
		expect(toItem({ id: 'i1' }).qty).toBe('');
	});

	it('rend zéro pour une date de création illisible', () => {
		expect(toItem({ id: 'i1', created_at: 'pas une date' }).createdAt).toBe(0);
	});

	it('convertit la virgule décimale en nombre pour l’écriture', () => {
		const item = toItem({ id: 'i1', qty: 6 });
		expect(fromItem({ ...item, qty: '1,5' }).qty).toBe(1.5);
	});

	it('écrit null pour une quantité qui ne parse pas', () => {
		const item = toItem({ id: 'i1' });
		expect(fromItem({ ...item, qty: 'beaucoup' }).qty).toBeNull();
	});

	it('écrit null, et non zéro, pour un champ quantité vidé', () => {
		const item = toItem({ id: 'i1', qty: 6 });
		expect(fromItem({ ...item, qty: '' }).qty).toBeNull();
		expect(fromItem({ ...item, qty: '   ' }).qty).toBeNull();
	});

	it('écrit null pour une quantité à plusieurs virgules', () => {
		const item = toItem({ id: 'i1' });
		expect(fromItem({ ...item, qty: '1,234,5' }).qty).toBeNull();
	});

	it('range le rayon vide en null, jamais en chaîne vide', () => {
		const item = toItem({ id: 'i1', aisle_id: null });
		expect(fromItem(item).aisle_id).toBeNull();
	});

	it('range la note et l’assignation absentes en null', () => {
		const item = toItem({ id: 'i1' });
		expect(fromItem(item).note).toBeNull();
		expect(fromItem(item).assigned_to).toBeNull();
	});
});

describe('toCard / fromCard', () => {
	it('lit une ligne complète', () => {
		const card = toCard({
			id: 'c1',
			shop_id: 's1',
			brand: 'Carrefour',
			name: 'Carte fidélité',
			num: '123',
			code: 'ABC',
			code_type: 'ean_13',
			points: 42,
			tint: 'blue',
			grad: 'radial',
			notes: 'note'
		});
		expect(card.codeType).toBe('ean_13');
		expect(card.points).toBe(42);
		expect(card.notes).toBe('note');
	});

	it('retombe sur code_39 et zéro point par défaut', () => {
		const card = toCard({ id: 'c1' });
		expect(card.codeType).toBe('code_39');
		expect(card.points).toBe(0);
		expect(card.notes).toBeUndefined();
	});

	it('range le magasin absent en null pour l’écriture', () => {
		expect(fromCard(toCard({ id: 'c1', shop_id: '' }), 'h1').shop_id).toBeNull();
	});
});

describe('toMember', () => {
	it('affiche le nom du profil, avec ses initiales et sa photo', () => {
		const member = toMember(
			{ user_id: 'u1', role: 'owner', tint: 'green' },
			{ display_name: 'Hélène Moreau', initial: 'HM', avatar: 'data:image/jpeg;base64,x' },
			'someone-else'
		);
		expect(member).toEqual({
			id: 'u1',
			name: 'Hélène Moreau',
			role: 'owner',
			initial: 'HM',
			tint: 'green',
			avatar: 'data:image/jpeg;base64,x'
		});
	});

	it("marque 'self' le membre courant, quel que soit son rôle en base", () => {
		const member = toMember({ user_id: 'u1', role: 'owner' }, { display_name: 'Moi' }, 'u1');
		expect(member.role).toBe('self');
	});

	it("retombe sur 'member' pour un rôle absent comme pour un rôle vide", () => {
		expect(toMember({ user_id: 'u1' }, { display_name: 'Moi' }, 'x').role).toBe('member');
		expect(toMember({ user_id: 'u1', role: '' }, { display_name: 'Moi' }, 'x').role).toBe('member');
	});

	it("retombe sur l'email puis sur un tiret si le nom manque", () => {
		expect(toMember({ user_id: 'u1' }, { email: 'a@b.test' }, 'x').name).toBe('a@b.test');
		expect(toMember({ user_id: 'u1' }, undefined, 'x').name).toBe('—');
	});

	it("calcule les initiales quand le profil n'en fournit pas", () => {
		const member = toMember({ user_id: 'u1' }, { display_name: 'Jean Dupont' }, 'x');
		expect(member.initial).toBe('JD');
	});

	it('ne fabrique pas de photo par défaut', () => {
		expect(toMember({ user_id: 'u1' }, { display_name: 'Moi' }, 'x').avatar).toBeUndefined();
	});
});

describe('toLayout / fromLayout', () => {
	it('lit un ordre de rayons', () => {
		expect(toLayout({ shop_id: 's1', aisle_order: ['a1', 'a2'], learned: true })).toEqual({
			shopId: 's1',
			aisleOrder: ['a1', 'a2'],
			learned: true
		});
	});

	it("rend un tableau vide si la colonne n'est pas un tableau", () => {
		expect(toLayout({ shop_id: 's1', aisle_order: null }).aisleOrder).toEqual([]);
	});

	it('écrit le propriétaire de la disposition', () => {
		const layout = toLayout({ shop_id: 's1', aisle_order: ['a1'], learned: true });
		expect(fromLayout(layout, 'u1')).toEqual({
			shop_id: 's1',
			user_id: 'u1',
			aisle_order: ['a1'],
			learned: true
		});
	});
});

describe('toItemOrder / fromItemOrder', () => {
	it('fabrique une clé composée stable', () => {
		const order = toItemOrder({ shop_id: 's1', aisle_id: 'a1', product_slugs: ['pommes'] });
		expect(order.key).toBe(order.key);
		expect(order.shopId).toBe('s1');
		expect(order.aisleId).toBe('a1');
		expect(order.productSlugs).toEqual(['pommes']);
	});

	it("rend un tableau vide si product_slugs n'est pas un tableau", () => {
		expect(toItemOrder({ shop_id: 's1', aisle_id: 'a1', product_slugs: undefined }).productSlugs).toEqual(
			[]
		);
	});

	it('écrit le propriétaire de l’ordre', () => {
		const order = toItemOrder({ shop_id: 's1', aisle_id: 'a1', product_slugs: ['pommes'] });
		expect(fromItemOrder(order, 'u1')).toEqual({
			shop_id: 's1',
			user_id: 'u1',
			aisle_id: 'a1',
			product_slugs: ['pommes']
		});
	});
});

describe('toMessage / fromMessage', () => {
	it('lit un message', () => {
		const message = toMessage({
			id: 'm1',
			list_id: 'l1',
			user_id: 'u1',
			body: 'Salut',
			is_system: false,
			created_at: '2026-01-01T00:00:00Z'
		});
		expect(message.body).toBe('Salut');
		expect(message.isSystem).toBe(false);
	});

	it('range l’auteur absent en null pour un message système', () => {
		const message = toMessage({ id: 'm1', body: 'Bienvenue', is_system: true });
		expect(fromMessage(message).user_id).toBeNull();
	});
});

describe('toPoll / fromPoll', () => {
	it('retombe sur le type date par défaut', () => {
		expect(toPoll({ id: 'p1', message_id: 'm1', question: 'Quand ?' }).kind).toBe('date');
	});

	it('conserve le type déclaré', () => {
		const poll = toPoll({ id: 'p1', kind: 'menu', question: 'Quoi ?', closed: true });
		expect(fromPoll(poll)).toEqual({
			id: 'p1',
			message_id: '',
			kind: 'menu',
			question: 'Quoi ?',
			closed: true
		});
	});
});

describe('toPollOption / fromPollOption', () => {
	it('lit une option complète', () => {
		const option = toPollOption({
			id: 'o1',
			poll_id: 'p1',
			label: 'Samedi',
			emoji: '📅',
			claimed_by: 'u1',
			ingredients: ['sel'],
			position: 1
		});
		expect(option.emoji).toBe('📅');
		expect(option.ingredients).toEqual(['sel']);
	});

	it("rend un tableau vide d'ingrédients par défaut", () => {
		expect(toPollOption({ id: 'o1' }).ingredients).toEqual([]);
	});

	it('range emoji et claimedBy absents en null pour l’écriture', () => {
		const option = toPollOption({ id: 'o1' });
		expect(fromPollOption(option).emoji).toBeNull();
		expect(fromPollOption(option).claimed_by).toBeNull();
	});
});

describe('toPollVote', () => {
	it('fabrique une clé à partir de l’option et du votant', () => {
		const vote = toPollVote({ option_id: 'o1', user_id: 'u1' });
		expect(vote.optionId).toBe('o1');
		expect(vote.userId).toBe('u1');
		expect(vote.key).toContain('o1');
		expect(vote.key).toContain('u1');
	});
});
