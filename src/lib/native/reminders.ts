import { Capacitor } from '@capacitor/core';
import type { ReminderPlan } from '$domain/reminder';

/**
 * Les rappels de date, portés par l'appareil lui-même.
 *
 * Il n'y a pas de serveur ici : l'application est un paquet statique et une base Supabase, sans
 * tâche planifiée ni service de push. Une notification envoyée depuis le serveur supposerait une
 * infrastructure qui n'existe pas. Restent les notifications locales de Capacitor : le système
 * d'exploitation garde l'alarme et la déclenche même application fermée, sans réseau. C'est la
 * seule option qui tienne la promesse.
 *
 * Côté web, il n'y en a aucune. L'API Notification du navigateur ne se déclenche que si une page
 * est vivante pour appeler `new Notification(...)` ; réveiller un onglet fermé demande un service
 * de push, donc un serveur. On ne fait donc rien du tout sur le web, et l'interface le dit — mieux
 * vaut une promesse absente qu'une promesse non tenue.
 */
export type ReminderPermission = 'granted' | 'denied' | 'unsupported';

export function remindersSupported(): boolean {
	return Capacitor.isNativePlatform();
}

/**
 * Demander l'autorisation, et seulement sur un geste de la personne.
 *
 * Android 13 la réclame à l'exécution, et un refus est définitif au bout de deux fois : la
 * demander au lancement, avant que quiconque ait posé une date, gaspillerait la seule occasion de
 * l'obtenir. Un refus n'est pas une erreur — la date reste posée et affichée, c'est le rappel
 * seul qui disparaît.
 */
export async function requestReminderPermission(): Promise<ReminderPermission> {
	if (!remindersSupported()) return 'unsupported';

	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');

		const actuelle = await LocalNotifications.checkPermissions();
		if (actuelle.display === 'granted') return 'granted';

		const demandee = await LocalNotifications.requestPermissions();
		return demandee.display === 'granted' ? 'granted' : 'denied';
	} catch {
		return 'unsupported';
	}
}

/**
 * Reposer d'un bloc tous les rappels de l'appareil.
 *
 * On annule tout puis on reprogramme, plutôt que de tenir un journal des différences. C'est ce qui
 * rend le reste simple : une date changée, une date effacée, une liste terminée ou supprimée, une
 * date passée — aucun de ces cas n'a de code à lui, il suffit que le plan ne le contienne plus.
 *
 * Et comme c'est rejoué à chaque ouverture, une réinstallation ou un redémarrage du téléphone, qui
 * vident les alarmes du système, se rattrapent au lancement suivant sans rien demander.
 *
 * L'annulation ne vise que nos propres identifiants : l'application n'a pas d'autre notification
 * aujourd'hui, mais effacer celles d'un futur voisin serait un piège discret.
 */
export async function applyReminders(
	plans: ReminderPlan[],
	texts: (plan: ReminderPlan) => { title: string; body: string }
): Promise<void> {
	if (!remindersSupported()) return;

	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');

		// Pas de demande ici : sans autorisation on ne programme rien, en silence.
		const permission = await LocalNotifications.checkPermissions();
		if (permission.display !== 'granted') return;

		const attente = await LocalNotifications.getPending();
		const prevus = new Set(plans.map((plan) => plan.id));
		const perimes = attente.notifications.filter(
			(notification) => !prevus.has(Number(notification.id))
		);
		if (perimes.length) await LocalNotifications.cancel({ notifications: perimes });

		if (!plans.length) return;

		await LocalNotifications.schedule({
			notifications: plans.map((plan) => {
				const { title, body } = texts(plan);

				return {
					id: plan.id,
					title,
					body,
					// Pas d'alarme exacte, et c'est délibéré. Elle est la valeur par défaut du
					// plugin, mais sur Android 12+ elle ouvre l'écran système « Alarmes et
					// rappels » dès qu'elle manque — ici, à chaque ouverture de l'application,
					// sans que personne ne l'ait demandé. Un rappel de courses se contente
					// largement de la minute près, et `allowWhileIdle` suffit à le sortir de
					// l'économie de batterie : décalé de deux heures, il arriverait après la
					// fermeture du magasin.
					isExactNotification: false,
					schedule: { at: plan.at, allowWhileIdle: true }
				};
			})
		});
	} catch {
		// Plugin absent, canal refusé, alarme impossible : la liste et sa date restent utilisables.
	}
}
