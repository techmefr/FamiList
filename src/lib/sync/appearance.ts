import { supabase } from '$db/supabase';
import { settings } from '$stores/settings.svelte';

const COLUMNS = 'theme, accent_id, type_scale, font_id, motion, sound, haptics, has_seen_tour';

/**
 * Compte dont l'arbitrage initial a déjà eu lieu sur cet appareil.
 *
 * Tant qu'il n'a pas eu lieu, aucun envoi ne part. Sans ce verrou, l'envoi déclenché par le
 * premier rendu pouvait doubler la lecture encore en vol : les réglages de l'appareil partaient
 * vers la base, la lecture les relisait, et les préférences venues de l'autre appareil étaient
 * écrasées par celles-là mêmes qu'on venait d'y écrire.
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

	// On ne date l'envoi que s'il a abouti, sinon la modification serait considérée comme
	// transmise et le prochain démarrage la remplacerait par ce que dit la base.
	if (!error) settings.markSynced(userId);
}

/**
 * Les préférences d'apparence suivent la personne d'un appareil à l'autre.
 *
 * Le stockage local reste la source rapide : c'est lui que lit le script d'amorçage, avant le
 * premier rendu, pour qu'un rechargement en grande police ne passe pas par un éclair en petit. La
 * base n'est qu'un relais entre appareils, consulté une fois la session connue.
 *
 * Un échec réseau ne casse rien et ne se signale pas : les réglages locaux restent en place et le
 * prochain démarrage réessaiera. Rien ici ne vaut la peine d'interrompre quelqu'un.
 */
export async function syncAppearance(userId: string) {
	if (settings.localWins(userId)) {
		await push(userId);
	} else {
		await pull(userId);
	}

	arbitrated = userId;
}

/** Renvoie un réglage modifié depuis l'interface, une fois l'arbitrage initial passé. */
export async function pushAppearance(userId: string) {
	if (arbitrated !== userId || !settings.localWins(userId)) return;

	await push(userId);
}
