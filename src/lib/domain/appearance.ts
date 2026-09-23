/** The appearance columns of `profiles`, in the shape the database expects. */
export interface AppearanceRow {
	theme: string;
	accent_id: string;
	type_scale: string;
	font_id: string;
	motion: string;
	hand: string;
	sound: boolean;
	haptics: boolean;
	nearby_cards: boolean;
	has_seen_tour: boolean;
}

/**
 * What synchronising the appearance needs from the settings, and nothing more.
 *
 * Declared here rather than imported from `$stores/settings.svelte` so that the transfer stays below the
 * store instead of beside it: a store may call the synchronisation, the synchronisation never reaches back
 * up to a store. The caller passes the settings in, which is also what lets the tests drive it with a plain
 * object instead of the real one.
 */
export interface AppearanceStore {
	localWins(userId: string): boolean;
	snapshot(): AppearanceRow;
	adoptRemote(row: Partial<AppearanceRow>, userId: string): void;
	markSynced(userId: string): void;
}

/** The sync bookkeeping `localWins` arbitrates on, kept outside the store so it can be tested without one. */
export interface SyncBookkeeping {
	changedAt: number;
	syncedAt: number;
	syncedFor: string | null;
}

/**
 * Who is right, the device or the database, when this account opens here.
 *
 * The device wins in two cases: the settings were touched without any account ever having received a
 * send — that is the welcome journey, where you pick your size before creating your account — or they
 * changed since the last successful send for this same account, offline for instance. Everywhere else, it
 * is the database: you are arriving on a new device, or `syncedFor` names a different account than the one
 * signing in now (a shared device the previous account signed out of without its bookkeeping being reset).
 */
export function localWins(bookkeeping: SyncBookkeeping, userId: string): boolean {
	if (bookkeeping.syncedFor === null) return bookkeeping.changedAt > 0;

	return bookkeeping.syncedFor === userId && bookkeeping.changedAt > bookkeeping.syncedAt;
}
