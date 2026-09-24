import { db, type Item, type List } from '$db/schema';

/**
 * The shopping lists, read and written directly against the local database, for the one screen that can
 * show before an instance is configured.
 *
 * `DataStore` is not reused here on purpose: every one of its writes eventually reaches `sync`, which reads
 * `sync.householdId` from a signed-in session — exactly what does not exist yet on this screen. Rather than
 * teach a nearly two-thousand-line store to tolerate a session that may never come, this is its own small
 * store, talking to the same `lists`/`items` tables Dexie already has. A list created here carries no
 * `householdId` — the same shape `DataStore` already gives a personal, unshared list — so nothing needs to
 * move the day this device is pointed at a real backend; today's checklists simply become the first ones
 * `DataStore` finds.
 */
class OfflineListsStore {
	lists = $state<List[]>([]);
	items = $state<Item[]>([]);
	ready = $state(false);

	async load(): Promise<void> {
		const [lists, items] = await Promise.all([db.lists.toArray(), db.items.toArray()]);
		this.lists = lists;
		this.items = items;
		this.ready = true;
	}

	itemsOf(listId: string): Item[] {
		return this.items.filter((item) => item.listId === listId);
	}

	async addList(name: string): Promise<List> {
		const trimmed = name.trim();
		const list: List = {
			id: crypto.randomUUID(),
			name: trimmed === '' ? '' : trimmed,
			emoji: '🛒',
			color: '#a94008',
			memberIds: []
		};

		await db.lists.add(list);
		this.lists = [...this.lists, list];
		return list;
	}

	async removeList(id: string): Promise<void> {
		await db.transaction('rw', db.lists, db.items, async () => {
			await db.lists.delete(id);
			await db.items.where('listId').equals(id).delete();
		});
		this.lists = this.lists.filter((list) => list.id !== id);
		this.items = this.items.filter((item) => item.listId !== id);
	}

	async addItem(listId: string, name: string): Promise<void> {
		const trimmed = name.trim();
		if (trimmed === '') return;

		const item: Item = {
			id: crypto.randomUUID(),
			listId,
			// No aisle grouping in this mode: there is no shop to learn a route from yet, only a flat
			// checklist. `''` is the same "not sorted" value `DataStore` falls back to.
			aisleId: '',
			name: trimmed,
			qty: '',
			unit: '',
			checked: false,
			priority: false,
			createdAt: Date.now()
		};

		await db.items.add(item);
		this.items = [...this.items, item];
	}

	async toggleItem(id: string): Promise<void> {
		const item = this.items.find((candidate) => candidate.id === id);
		if (!item) return;

		const checked = !item.checked;
		await db.items.update(id, { checked });
		this.items = this.items.map((candidate) =>
			candidate.id === id ? { ...candidate, checked } : candidate
		);
	}

	async removeItem(id: string): Promise<void> {
		await db.items.delete(id);
		this.items = this.items.filter((item) => item.id !== id);
	}
}

export const offlineLists = new OfflineListsStore();
