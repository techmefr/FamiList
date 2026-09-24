import {
	cardShareKey,
	itemOrderKey,
	pollVoteKey,
	recipeShareKey,
	type OutboxEntry,
	type Rejection
} from '$db/schema';

export type RejectedEntity = 'card' | 'list' | 'item' | 'shop' | 'recipe' | 'message' | 'other';

interface LocalTable {
	dexie: string;
	key: (match: Record<string, string>) => string | undefined;
	entity: RejectedEntity;
}

const byId = (dexie: string, entity: RejectedEntity): LocalTable => ({
	dexie,
	key: (match) => match.id,
	entity
});

const LOCAL_TABLES: Record<string, LocalTable> = {
	shops: byId('shops', 'shop'),
	aisles: byId('aisles', 'shop'),
	lists: byId('lists', 'list'),
	items: byId('items', 'item'),
	loyalty_cards: byId('cards', 'card'),
	messages: byId('messages', 'message'),
	polls: byId('polls', 'message'),
	poll_options: byId('pollOptions', 'message'),
	poll_votes: {
		dexie: 'pollVotes',
		key: (match) => pollVoteKey(match.option_id, match.user_id),
		entity: 'message'
	},
	item_prices: byId('prices', 'item'),
	recipes: byId('recipes', 'recipe'),
	recipe_ingredients: byId('recipeIngredients', 'recipe'),
	recipe_steps: byId('recipeSteps', 'recipe'),
	recipe_shares: {
		dexie: 'recipeShares',
		key: (match) => recipeShareKey(match.recipe_id, match.household_id),
		entity: 'recipe'
	},
	loyalty_card_shares: {
		dexie: 'cardShares',
		key: (match) => cardShareKey(match.card_id, match.household_id),
		entity: 'card'
	},
	meal_plans: byId('mealPlans', 'recipe'),
	meal_plan_recipes: byId('mealPlanRecipes', 'recipe'),
	household_persons: byId('householdPersons', 'other'),
	shop_layouts: { dexie: 'shopLayouts', key: (match) => match.shop_id, entity: 'shop' },
	shop_item_orders: {
		dexie: 'shopItemOrders',
		key: (match) => itemOrderKey(match.shop_id, match.aisle_id),
		entity: 'shop'
	},
	conversations: byId('conversations', 'message')
};

export function rejectionKey(entry: Pick<OutboxEntry, 'table' | 'match'>): string {
	const match = Object.keys(entry.match)
		.sort()
		.map((field) => `${field}=${entry.match[field]}`)
		.join('&');
	return `${entry.table}?${match}`;
}

export function toRejection(
	entry: OutboxEntry,
	error: { code?: string; message?: string },
	at: string
): Rejection {
	return {
		key: rejectionKey(entry),
		table: entry.table,
		op: entry.op,
		match: entry.match,
		payload: entry.payload,
		code: error.code ?? '',
		message: error.message ?? '',
		at
	};
}

export function retryEntry(rejection: Rejection): OutboxEntry {
	return {
		table: rejection.table,
		op: rejection.op,
		match: rejection.match,
		payload: rejection.payload
	};
}

export function rejectedEntity(rejection: Pick<Rejection, 'table'>): RejectedEntity {
	return LOCAL_TABLES[rejection.table]?.entity ?? 'other';
}

export interface ProtectedRow {
	dexie: string;
	key: string;
	op: OutboxEntry['op'];
}

export function protectedRows(rejections: Rejection[]): ProtectedRow[] {
	return rejections.flatMap((rejection) => {
		const local = LOCAL_TABLES[rejection.table];
		const key = local?.key(rejection.match);
		if (!local || !key || key.includes('undefined')) return [];
		return [{ dexie: local.dexie, key, op: rejection.op }];
	});
}

export type Restore =
	| { kind: 'put'; dexie: string; row: unknown }
	| { kind: 'delete'; dexie: string; key: string };

export function restorePlan(
	rows: ProtectedRow[],
	local: (row: ProtectedRow) => unknown | undefined
): Restore[] {
	return rows.flatMap((row): Restore[] => {
		if (row.op === 'delete') return [{ kind: 'delete', dexie: row.dexie, key: row.key }];
		const kept = local(row);
		return kept === undefined ? [] : [{ kind: 'put', dexie: row.dexie, row: kept }];
	});
}
