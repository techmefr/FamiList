import { browser } from '$app/environment';
import { supabase } from '$db/supabase';
import { db, type OutboxEntry } from '$db/schema';
import {
	toAisle,
	toCard,
	toItem,
	toItemOrder,
	toLayout,
	toList,
	toMember,
	toShop
} from './mapping';

const HOUSEHOLD_KEY = 'familist:household';

/**
 * Codes Postgres qu'un nouvel essai ne réglera jamais : donnée mal formée, référence absente,
 * champ obligatoire vide, droit refusé. Tout le reste (réseau coupé, serveur indisponible) mérite
 * d'attendre son tour.
 */
const PERMANENT_CODES = new Set(['22P02', '23502', '23503', '23505', '23514', '42501', '42703']);

const isPermanent = (code: string | undefined) => code !== undefined && PERMANENT_CODES.has(code);

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

/**
 * Le serveur fait autorité, Dexie est le cache qui permet d'ouvrir l'application dans un magasin
 * sans réseau. Les écritures partent par une file : on répond tout de suite à l'écran, on pousse
 * ensuite. Le volume d'un foyer est petit, donc on relit tout à chaque synchronisation plutôt que
 * de tenir un journal de deltas — un mécanisme de moins à maintenir et à déboguer.
 */
class SyncStore {
	householdId = $state<string | null>(null);
	state = $state<SyncState>('idle');
	lastError = $state<string | null>(null);

	private channel: ReturnType<typeof supabase.channel> | null = null;
	private pulling: Promise<void> | null = null;
	private onPulled: (() => void) | null = null;

	/** Appelé une fois le compte validé. Renvoie true si le cache local a été rempli. */
	async start(onPulled: () => void) {
		if (!browser) return false;

		this.onPulled = onPulled;

		// L'état est branché sur le navigateur, pas seulement sur nos appels : sinon le bandeau
		// n'apparaîtrait qu'à la première écriture, longtemps après la perte du réseau.
		addEventListener('online', () => void this.resume());
		addEventListener('offline', () => (this.state = 'offline'));

		if (!navigator.onLine) {
			this.state = 'offline';
			this.householdId = localStorage.getItem(HOUSEHOLD_KEY);
			return false;
		}

		if (!(await this.provision())) return false;

		await this.flush();
		await this.pull();
		this.listen();
		return true;
	}

	stop() {
		this.channel?.unsubscribe();
		this.channel = null;
		this.householdId = null;
		this.state = 'idle';
	}

	private async resume() {
		if (!navigator.onLine) return;
		if (!this.householdId && !(await this.provision())) return;

		await this.flush();
		await this.pull();
		this.listen();
	}

	private async provision() {
		const { data, error } = await supabase.rpc('ensure_household');

		if (error) {
			this.state = 'error';
			this.lastError = error.message;
			return false;
		}

		this.householdId = data as unknown as string;
		localStorage.setItem(HOUSEHOLD_KEY, this.householdId);
		return true;
	}

	/**
	 * Relit le foyer entier et remplace le cache. Les tables sont vidées et réécrites dans une
	 * seule transaction : un rayon supprimé sur un autre appareil disparaît vraiment ici, ce qu'un
	 * simple bulkPut ne ferait pas.
	 */
	async pull() {
		if (this.pulling) return this.pulling;

		this.pulling = this.pullOnce().finally(() => {
			this.pulling = null;
		});

		return this.pulling;
	}

	private async pullOnce() {
		const household = this.householdId;
		if (!household) return;

		this.state = 'syncing';

		const [shops, aisles, lists, listMembers, items, cards, members, layouts, itemOrders] =
			await Promise.all([
				supabase.from('shops').select('*').eq('household_id', household),
				supabase.from('aisles').select('*').eq('household_id', household),
				supabase.from('lists').select('*').eq('household_id', household),
				supabase.from('list_members').select('*'),
				supabase.from('items').select('*'),
				supabase.from('loyalty_cards').select('*').eq('household_id', household),
				supabase.from('household_members').select('*').eq('household_id', household),
				supabase.from('shop_layouts').select('*'),
				supabase.from('shop_item_orders').select('*')
			]);

		const failed = [shops, aisles, lists, listMembers, items, cards, members, layouts, itemOrders]
			.map((result) => result.error)
			.find(Boolean);

		if (failed) {
			this.state = 'error';
			this.lastError = failed.message;
			return;
		}

		const { data: session } = await supabase.auth.getUser();
		const currentUserId = session.user?.id ?? '';

		const profiles = await supabase
			.from('profiles')
			.select('id, display_name, initial')
			.in('id', (members.data ?? []).map((row) => row.user_id as string));

		// Un membre du foyer autre que soi n'est pas lisible dans profiles (la policy limite la
		// lecture à son propre profil et aux admins). On affiche alors ce que porte le
		// rattachement, plutôt que de faire disparaître la personne de la liste.
		const profileById = new Map(
			(profiles.data ?? []).map((row) => [row.id as string, row as Record<string, unknown>])
		);

		const membersByList = new Map<string, string[]>();
		for (const row of listMembers.data ?? []) {
			const listId = row.list_id as string;
			membersByList.set(listId, [...(membersByList.get(listId) ?? []), row.user_id as string]);
		}

		await db.transaction(
			'rw',
			[db.shops, db.aisles, db.lists, db.items, db.cards, db.members, db.shopLayouts, db.shopItemOrders],
			async () => {
				await Promise.all([
					db.shops.clear(),
					db.aisles.clear(),
					db.lists.clear(),
					db.items.clear(),
					db.cards.clear(),
					db.members.clear(),
					db.shopLayouts.clear(),
					db.shopItemOrders.clear()
				]);

				await Promise.all([
					db.shops.bulkAdd((shops.data ?? []).map(toShop)),
					db.aisles.bulkAdd((aisles.data ?? []).map(toAisle)),
					db.lists.bulkAdd(
						(lists.data ?? []).map((row) => toList(row, membersByList.get(row.id as string) ?? []))
					),
					db.items.bulkAdd((items.data ?? []).map(toItem)),
					db.cards.bulkAdd((cards.data ?? []).map(toCard)),
					db.members.bulkAdd(
						(members.data ?? []).map((row) =>
							toMember(row, profileById.get(row.user_id as string), currentUserId)
						)
					),
					db.shopLayouts.bulkAdd((layouts.data ?? []).map(toLayout)),
					db.shopItemOrders.bulkAdd((itemOrders.data ?? []).map(toItemOrder))
				]);
			}
		);

		this.state = 'idle';
		this.lastError = null;
		this.onPulled?.();
	}

	/** Enregistre une écriture et tente de la pousser tout de suite. */
	async enqueue(entry: OutboxEntry) {
		await db.outbox.add(entry);
		void this.flush();
	}

	/**
	 * Vide la file dans l'ordre d'arrivée. L'ordre compte : une liste doit exister avant ses
	 * articles. Une panne réseau arrête la boucle et laisse tout en attente. Un refus définitif du
	 * serveur, lui, jette l'écriture : la garder bloquerait la file pour toujours et l'utilisateur
	 * ne verrait plus rien partir.
	 */
	async flush() {
		if (!browser || !navigator.onLine) {
			this.state = 'offline';
			return;
		}

		const pending = await db.outbox.orderBy('seq').toArray();

		for (const entry of pending) {
			const query = supabase.from(entry.table as 'items');

			const { error } =
				entry.op === 'delete'
					? await query.delete().match(entry.match)
					: await query.upsert(entry.payload as never);

			if (error && !isPermanent(error.code)) {
				this.state = 'error';
				this.lastError = error.message;
				return;
			}

			if (error) {
				this.state = 'error';
				this.lastError = error.message;
			}

			await db.outbox.delete(entry.seq as number);
		}

		if (this.state !== 'error') this.state = 'idle';
	}

	/**
	 * Un changement venu d'un autre appareil déclenche une relecture complète. Nos propres
	 * écritures reviennent aussi par ce canal : sans le délai, cocher un article relirait tout le
	 * foyer à chaque case cochée.
	 */
	private listen() {
		if (this.channel || !this.householdId) return;

		this.channel = supabase
			.channel(`household:${this.householdId}`)
			.on('postgres_changes', { event: '*', schema: 'public' }, () => this.schedulePull())
			.subscribe();
	}

	private pullTimer: ReturnType<typeof setTimeout> | null = null;

	private schedulePull() {
		if (this.pullTimer) clearTimeout(this.pullTimer);
		this.pullTimer = setTimeout(() => void this.pull(), 800);
	}
}

export const sync = new SyncStore();
