import { db, itemOrderKey, type Item } from './schema';

/**
 * Jeu de départ repris de proto-claude-design/src/data.js. Il n'est écrit qu'une fois, sur une base
 * vide : une fois que l'utilisateur a ses propres listes, on n'y touche plus.
 */
const SHOPS = [
	{ id: 'halles', name: 'Les Halles du Quartier', short: 'HQ', tint: '#5A4A2F', dist: '400 m' },
	{ id: 'fraicheur', name: 'Fraîcheur & Co', short: 'FC', tint: '#8B3A62', dist: '850 m' },
	{ id: 'biovrac', name: 'BioVrac', short: 'BV', tint: '#4A6B3A', dist: '1,2 km' },
	{ id: 'marche', name: "Le Marché d'Alice", short: 'MA', tint: '#C67A3E', dist: '600 m' }
];

const LAYOUTS: Record<string, string[]> = {
	halles: ['fruits', 'boulangerie', 'laitier', 'viande', 'epicerie', 'maison'],
	fraicheur: ['fruits', 'laitier', 'boulangerie', 'epicerie', 'viande', 'maison'],
	biovrac: ['epicerie', 'fruits', 'maison', 'laitier', 'boulangerie', 'viande'],
	marche: ['viande', 'fruits', 'laitier', 'boulangerie', 'epicerie', 'maison']
};

const LEARNED = new Set(['halles']);

const AISLES = [
	{ id: 'fruits', name: 'Fruits & Légumes', emoji: '🥬' },
	{ id: 'boulangerie', name: 'Boulangerie', emoji: '🥖' },
	{ id: 'laitier', name: 'Produits laitiers', emoji: '🥛' },
	{ id: 'viande', name: 'Viande & Poisson', emoji: '🐟' },
	{ id: 'epicerie', name: 'Épicerie', emoji: '🫙' },
	{ id: 'maison', name: 'Entretien', emoji: '🧴' }
];

const MEMBERS = [
	{ id: 'u1', name: 'Hélène', role: 'Vous', initial: 'H', tint: '#C8532A' },
	{ id: 'u2', name: 'Marc', role: 'Conjoint', initial: 'M', tint: '#1F5C3A' },
	{ id: 'u3', name: 'Camille', role: 'Fille', initial: 'C', tint: '#2563EB' }
];

const LISTS = [
	{
		id: 'l1',
		name: 'Courses de la semaine',
		emoji: '🛒',
		color: '#C8532A',
		memberIds: ['u1', 'u2', 'u3']
	},
	{ id: 'l2', name: 'Pharmacie & soins', emoji: '💊', color: '#2563EB', memberIds: ['u1'] },
	{
		id: 'l3',
		name: 'Réception samedi',
		emoji: '🎉',
		color: '#1F5C3A',
		memberIds: ['u1', 'u2'],
		eventDate: 'Samedi 23 mai — 19h30'
	}
];

const RAW_ITEMS: [string, string, string, string, string, boolean, boolean, string?][] = [
	['l1', 'Tomates grappe', '500', 'g', 'fruits', false, true, 'Bien mûres'],
	['l1', 'Pommes Gala', '6', 'pièces', 'fruits', false, false],
	['l1', 'Salade batavia', '1', 'pièce', 'fruits', true, false],
	['l1', 'Baguette tradition', '2', 'pièces', 'boulangerie', false, false],
	['l1', 'Croissants', '4', 'pièces', 'boulangerie', true, false],
	['l1', 'Lait demi-écrémé', '1', 'L', 'laitier', false, true],
	['l1', 'Yaourts nature', '8', 'pots', 'laitier', false, false],
	['l1', 'Comté', '200', 'g', 'laitier', false, false, '18 mois'],
	['l1', 'Filets de cabillaud', '400', 'g', 'viande', false, true],
	['l1', 'Riz basmati', '1', 'kg', 'epicerie', true, false],
	['l1', "Huile d'olive", '1', 'bouteille', 'epicerie', false, false],
	['l1', 'Liquide vaisselle', '1', 'flacon', 'maison', false, false],
	['l2', 'Dentifrice', '1', 'tube', 'maison', false, false],
	['l2', 'Savon de Marseille', '2', 'pièces', 'maison', false, false],
	['l2', 'Mouchoirs', '1', 'paquet', 'maison', true, false],
	['l2', 'Pastilles miel-citron', '1', 'boîte', 'epicerie', false, false],
	['l2', 'Tisane verveine', '1', 'boîte', 'epicerie', false, false],
	['l3', 'Champagne brut', '2', 'bouteilles', 'epicerie', false, false],
	['l3', 'Chips artisanales', '3', 'paquets', 'epicerie', false, false],
	['l3', 'Olives marinées', '300', 'g', 'epicerie', false, false],
	['l3', 'Saumon fumé', '400', 'g', 'viande', false, false],
	['l3', 'Pain de campagne', '1', 'pièce', 'boulangerie', false, false],
	['l3', 'Plateau de fromages', '1', 'pièce', 'laitier', false, false],
	['l3', 'Raisin blanc', '500', 'g', 'fruits', false, false]
];

const CARDS = [
	{
		id: 'c1',
		shopId: 'halles',
		name: 'Les Halles du Quartier',
		num: '•••• •••• 4421',
		code: '9352004421',
		codeType: 'code_39' as const,
		points: 1284,
		tint: '#5A4A2F',
		grad: 'linear-gradient(135deg, #5A4A2F 0%, #2E2518 100%)',
		notes: 'Réduction 5% le mardi sur les fruits.'
	},
	{
		id: 'c2',
		shopId: 'fraicheur',
		name: 'Fraîcheur & Co — Fidélité',
		num: '•••• •••• 8803',
		code: 'FC-8471-8803',
		codeType: 'qr_code' as const,
		points: 642,
		tint: '#8B3A62',
		grad: 'linear-gradient(135deg, #8B3A62 0%, #4F1F37 100%)',
		notes: "Compte en ligne au nom d'Hélène."
	},
	{
		id: 'c3',
		shopId: 'biovrac',
		name: 'BioVrac Coopérateur',
		num: '•••• •••• 1172',
		code: '4019871172',
		codeType: 'ean_13' as const,
		points: 95,
		tint: '#4A6B3A',
		grad: 'linear-gradient(135deg, #4A6B3A 0%, #273B1E 100%)'
	},
	{
		id: 'c4',
		shopId: 'marche',
		name: "Le Marché d'Alice",
		num: '•••• •••• 5520',
		code: '270098155207',
		codeType: 'ean_13' as const,
		points: 418,
		tint: '#C67A3E',
		grad: 'linear-gradient(135deg, #C67A3E 0%, #7A4820 100%)'
	}
];

export async function seedIfEmpty() {
	const alreadySeeded = await db.lists.count();
	if (alreadySeeded > 0) return;

	const items: Item[] = RAW_ITEMS.map(
		([listId, name, qty, unit, aisleId, checked, priority, note], index) => ({
			id: `seed-${index}`,
			listId,
			aisleId,
			name,
			qty,
			unit,
			checked,
			priority,
			note,
			createdAt: index
		})
	);

	await db.transaction(
		'rw',
		[db.shops, db.aisles, db.lists, db.items, db.cards, db.members, db.shopLayouts],
		async () => {
			await db.shops.bulkAdd(SHOPS);
			await db.aisles.bulkAdd(AISLES);
			await db.lists.bulkAdd(LISTS);
			await db.items.bulkAdd(items);
			await db.cards.bulkAdd(CARDS);
			await db.members.bulkAdd(MEMBERS);
			await db.shopLayouts.bulkAdd(
				Object.entries(LAYOUTS).map(([shopId, aisleOrder]) => ({
					shopId,
					aisleOrder,
					learned: LEARNED.has(shopId)
				}))
			);
		}
	);
}

export { itemOrderKey };
