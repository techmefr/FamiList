import { supabase } from '$db/supabase';
import { settings } from '$stores/settings.svelte';

const COLUMNS =
	'theme, accent_id, type_scale, font_id, motion, hand, sound, haptics, nearby_cards, has_seen_tour';

/**
 * Account whose initial arbitration has already happened on this device.
 *
 * Until it has, nothing is sent. Without this lock, the send triggered by the first render could overtake
 * the read still in flight: the device's settings left for the database, the read took them back, and the
 * preferences coming from the other device were overwritten by the very ones just written there.
 */
let arbitrated: string | null = null;

async function pull(userId: string) {
	const { data, error } = await supabase
		.from('profiles')
		.select(COLUMNS)
		.eq('id', userId)
		.maybeSingle();

	if (error || !data) return;

	settings.adoptRemote(data, userId);
}

async function push(userId: string) {
	const { error } = await supabase.from('profiles').update(settings.snapshot()).eq('id', userId);

	// We only date the send if it went through, otherwise the change would be considered transmitted and the
	// next start-up would replace it with what the database says.
	if (!error) settings.markSynced(userId);
}

/**
 * Appearance preferences follow the person from one device to another.
 *
 * Local storage stays the fast source: it is what the bootstrap script reads, before the first render, so
 * that a reload in large type does not go through a flash in small. The database is only a relay between
 * devices, consulted once the session is known.
 *
 * A network failure breaks nothing and reports nothing: the local settings stay in place and the next
 * start-up will try again. Nothing here is worth interrupting somebody for.
 */
export async function syncAppearance(userId: string) {
	if (settings.localWins(userId)) {
		await push(userId);
	} else {
		await pull(userId);
	}

	arbitrated = userId;
}

/** Sends a setting changed from the interface, once the initial arbitration is past. */
export async function pushAppearance(userId: string) {
	if (arbitrated !== userId || !settings.localWins(userId)) return;

	await push(userId);
}
