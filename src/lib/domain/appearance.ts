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
