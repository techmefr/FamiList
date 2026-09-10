import { browser } from '$app/environment';
import { supabase } from '$db/supabase';
import { db, type OutboxEntry } from '$db/schema';
import { describeError } from './errors';
import {
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
	private pullTimer: ReturnType<typeof setTimeout> | null = null;
	private watchingNetwork = false;

	/**
	 * Lance un travail qu'on ne peut pas attendre — la file poussée en arrière-plan, le réveil du
	 * réseau, la relecture différée du temps réel — sans le laisser finir en rejet muet.
	 *
	 * Sans cela, une panne de ces chemins-là s'écrit dans une console que personne n'ouvre :
	 * l'écran continue d'afficher un foyer qui a l'air à jour alors que plus rien ne part. On la
	 * ramène là où l'interface lit déjà l'état de la synchronisation.
	 */
	private detach(work: Promise<unknown>) {
		void work.catch((cause) => {
			this.state = 'error';
			this.lastError = describeError(cause);
		});
	}

	/** Appelé une fois le compte validé. Renvoie true si le cache local a été rempli. */
	async start(onPulled: () => void) {
		if (!browser) return false;

		this.onPulled = onPulled;

		// L'état est branché sur le navigateur, pas seulement sur nos appels : sinon le bandeau
		// n'apparaîtrait qu'à la première écriture, longtemps après la perte du réseau.
		//
		// Une seule fois : `start()` est rappelé à chaque changement de foyer ou de compte, et
		// sans cette garde chaque passage ajoutait une paire d'écouteurs. Après trois changements,
		// un simple retour du réseau lançait trois relectures complètes en même temps.
		if (!this.watchingNetwork) {
			this.watchingNetwork = true;
			addEventListener('online', () => this.detach(this.resume()));
			addEventListener('offline', () => (this.state = 'offline'));
		}

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
		// `removeChannel` et non `unsubscribe` : le client garde ses canaux indexés par sujet, et un
		// simple désabonnement laisserait celui-ci en place. Rejoindre un foyer puis revenir au
		// précédent réutiliserait alors un canal déjà abonné, que la bibliothèque refuse de
		// reconfigurer — le temps réel s'arrêterait sans rien dire.
		if (this.channel) supabase.removeChannel(this.channel);
		this.channel = null;
		this.householdId = null;
		this.state = 'idle';

		// Une relecture en vol appartient au foyer qu'on quitte. La garder ferait rendre cette
		// vieille promesse au prochain `pull()`, qui croirait avoir relu le nouveau foyer : on
		// rejoindrait une famille et l'écran resterait sur l'ancienne, sans plus rien attendre.
		this.pulling = null;

		// Une relecture programmée par le temps réel appartient elle aussi au foyer qu'on quitte.
		// Laissée en place, elle part huit dixièmes de seconde plus tard, au milieu du chargement
		// du nouveau foyer.
		if (this.pullTimer) clearTimeout(this.pullTimer);
		this.pullTimer = null;
	}

	private async resume() {
		if (!navigator.onLine) return;
		if (!this.householdId && !(await this.provision())) return;

		await this.flush();
		await this.pull();
		this.listen();
	}

	/**
	 * Le foyer, en attendant qu'il soit connu s'il ne l'est pas encore.
	 *
	 * Une écriture partie avant que le foyer soit provisionné portait jusqu'ici une chaîne vide à
	 * la place de l'identifiant. Postgres refuse — « invalid input syntax for type uuid » — et ce
	 * refus est définitif : la file jetait l'écriture, sans que rien ne la rattrape. Le magasin
	 * créé restait à l'écran le temps d'une relecture, puis disparaissait pour de bon.
	 *
	 * Mieux vaut donc attendre l'identifiant que d'écrire à côté. Rendre une chaîne vide reste
	 * possible — hors réseau, serveur en erreur — et l'appelant doit alors renoncer plutôt que
	 * d'enfiler quelque chose d'invalide.
	 */
	async whenHousehold(delaiMs = 5000): Promise<string> {
		if (this.householdId) return this.householdId;
		if (!browser) return '';

		/**
		 * On attend celui que `start()` est en train de poser — on n'en provisionne pas un second.
		 *
		 * `ensure_household` rend le foyer existant quand il y en a un, mais deux appels partis en
		 * même temps ne voient ni l'un ni l'autre de membre : les deux en créent un, et le compte
		 * se retrouve dans deux foyers dont un seul sera lu. Provisionner ici, en parallèle du
		 * démarrage, produisait exactement ça — et les listes du foyer disparaissaient.
		 */
		const fin = Date.now() + delaiMs;
		while (!this.householdId && Date.now() < fin) {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		return this.householdId ?? '';
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

		// Ce qui attend dans la file part d'abord. La relecture vide les tables et les réécrit
		// depuis le serveur : lancée alors qu'une écriture n'est pas encore partie, elle efface de
		// l'écran un magasin qu'on vient de créer, ou ramène celui qu'on vient de supprimer. Si la
		// file ne se vide pas — hors réseau, serveur en erreur — on ne relit pas du tout, plutôt
		// que d'écraser un travail qui n'a pas encore atteint le serveur.
		await this.flush(true);
		if ((await db.outbox.count()) > 0) return;

		this.state = 'syncing';

		const [
			shops,
			aisles,
			lists,
			listMembers,
			items,
			cards,
			members,
			layouts,
			itemOrders,
			messages,
			polls,
			pollOptions,
			pollVotes
		] = await Promise.all([
			supabase.from('shops').select('*').eq('household_id', household),
			supabase.from('aisles').select('*').eq('household_id', household),
			supabase.from('lists').select('*').eq('household_id', household),
			supabase.from('list_members').select('*'),
			supabase.from('items').select('*'),
			supabase.from('loyalty_cards').select('*').eq('household_id', household),
			supabase.from('household_members').select('*').eq('household_id', household),
			supabase.from('shop_layouts').select('*'),
			supabase.from('shop_item_orders').select('*'),
			supabase.from('messages').select('*'),
			supabase.from('polls').select('*'),
			supabase.from('poll_options').select('*'),
			supabase.from('poll_votes').select('*')
		]);

		const failed = [
			shops,
			aisles,
			lists,
			listMembers,
			items,
			cards,
			members,
			layouts,
			itemOrders,
			messages,
			polls,
			pollOptions,
			pollVotes
		]
			.map((result) => result.error)
			.find(Boolean);

		if (failed) {
			this.state = 'error';
			this.lastError = failed.message;
			return;
		}

		const { data: session } = await supabase.auth.getUser();
		const currentUserId = session.user?.id ?? '';

		// Les profils passent par une fonction : la policy de la table limite la lecture au sien,
		// et un foyer où personne n'a de nom ne se lit pas.
		const profiles = await supabase.rpc('household_profiles');

		const profileById = new Map(
			(profiles.data ?? []).map((row) => [row.id as string, row as Record<string, unknown>])
		);

		const membersByList = new Map<string, string[]>();
		for (const row of listMembers.data ?? []) {
			const listId = row.list_id as string;
			membersByList.set(listId, [...(membersByList.get(listId) ?? []), row.user_id as string]);
		}

		// Le foyer a pu changer pendant ces lectures — on vient de rejoindre une famille, ou de la
		// quitter. Écrire maintenant remplirait le cache avec le foyer précédent.
		if (this.householdId !== household) return;

		await db.transaction(
			'rw',
			[
				db.outbox,
				db.shops,
				db.aisles,
				db.lists,
				db.items,
				db.cards,
				db.members,
				db.shopLayouts,
				db.shopItemOrders,
				db.messages,
				db.polls,
				db.pollOptions,
				db.pollVotes
			],
			async () => {
				/**
				 * Dernier regard sur la file, à l'abri de la transaction.
				 *
				 * La file était vide au départ, mais treize lectures prennent du temps, et
				 * quelqu'un a pu créer un magasin pendant ce temps-là. Ce qu'on tient dans les
				 * mains ne connaît pas cette écriture : l'écrire effacerait de l'écran quelque
				 * chose que la personne vient de faire, et qui ne reviendrait qu'à la relecture
				 * suivante — quand elle a lieu. On a vu le magasin disparaître pour de bon.
				 *
				 * On abandonne donc cette relecture-là, sans rien toucher. L'envoi de l'écriture
				 * en attente en programme une autre derrière lui, avec un serveur qui la connaît.
				 *
				 * Le contrôle est ici, dans la transaction, et pas juste avant : Dexie sérialise
				 * les transactions sur ces tables, ce qui ferme la fenêtre au lieu de la réduire.
				 */
				if ((await db.outbox.count()) > 0) return;

				await Promise.all([
					db.shops.clear(),
					db.aisles.clear(),
					db.lists.clear(),
					db.items.clear(),
					db.cards.clear(),
					db.members.clear(),
					db.shopLayouts.clear(),
					db.shopItemOrders.clear(),
					db.messages.clear(),
					db.polls.clear(),
					db.pollOptions.clear(),
					db.pollVotes.clear()
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
					db.shopItemOrders.bulkAdd((itemOrders.data ?? []).map(toItemOrder)),
					db.messages.bulkAdd((messages.data ?? []).map(toMessage)),
					db.polls.bulkAdd((polls.data ?? []).map(toPoll)),
					db.pollOptions.bulkAdd((pollOptions.data ?? []).map(toPollOption)),
					db.pollVotes.bulkAdd((pollVotes.data ?? []).map(toPollVote))
				]);
			}
		);

		this.state = 'idle';
		this.lastError = null;
		this.onPulled?.();
	}

	/** Enregistre une écriture et tente de la pousser tout de suite. */
	async enqueue(entry: OutboxEntry) {
		// Les appelants n'attendent pas cette promesse — le magasin de données l'appelle depuis des
		// méthodes synchrones. Un stockage local plein doit donc se voir sur le bandeau plutôt que
		// disparaître : sans cela, l'écriture n'est ni partie ni signalée.
		try {
			await db.outbox.add(entry);
		} catch (cause) {
			this.state = 'error';
			this.lastError = describeError(cause);
			return;
		}

		this.detach(this.flush());
	}

	/**
	 * Vide la file dans l'ordre d'arrivée. L'ordre compte : une liste doit exister avant ses
	 * articles. Une panne réseau arrête la boucle et laisse tout en attente. Un refus définitif du
	 * serveur, lui, jette l'écriture : la garder bloquerait la file pour toujours et l'utilisateur
	 * ne verrait plus rien partir.
	 *
	 * `depuisRelecture` dit que l'appel vient de la relecture elle-même, qui vide la file avant de
	 * lire : elle n'a pas besoin qu'on lui en programme une seconde derrière.
	 */
	async flush(depuisRelecture = false) {
		if (!browser || !navigator.onLine) {
			this.state = 'offline';
			return;
		}

		const pending = await db.outbox.orderBy('seq').toArray();

		// L'erreur qui compte est celle de ce cycle-ci. En relisant `this.state`, un refus définitif
		// d'hier laissait le bandeau en erreur pour toujours, avec un message décrivant une écriture
		// déjà abandonnée, pendant que tout le reste partait normalement.
		let rejected = false;
		let sent = 0;

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
				rejected = true;
				this.state = 'error';
				this.lastError = error.message;
			}

			sent += 1;
			await db.outbox.delete(entry.seq as number);
		}

		// Relire après un refus définitif serait logique — l'écran doit montrer ce que le serveur a
		// vraiment. Essayé, et retiré : chaque relecture vide les douze tables et les réécrit, donc
		// reconstruit tout le DOM, et les refus de routine suffisaient à rendre les cartes de liste
		// inatteignables au clic. À reprendre quand la relecture réconciliera par identifiant au
		// lieu de tout remplacer (#95).
		if (rejected) return;

		this.state = 'idle';
		this.lastError = null;

		// Une relecture partie avant cet envoi a lu un serveur qui ne connaissait pas encore ces
		// écritures, et elle remplace le cache par ce qu'elle a lu : le magasin qu'on vient de
		// créer disparaît de l'écran alors qu'il est bien enregistré. On relit donc une fois
		// celle-là terminée, avec un serveur qui sait tout.
		if (sent > 0 && !depuisRelecture) {
			this.detach(Promise.resolve(this.pulling).then(() => this.pull()));
		}
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

	private schedulePull() {
		if (this.pullTimer) clearTimeout(this.pullTimer);
		this.pullTimer = setTimeout(() => this.detach(this.pull()), 800);
	}
}

export const sync = new SyncStore();
