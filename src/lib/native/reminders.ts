import { Capacitor } from '@capacitor/core';
import type { ReminderPlan } from '$domain/reminder';

/**
 * The date reminders, carried by the device itself.
 *
 * There is no server here: the application is a static bundle and a Supabase database, with no scheduled
 * task and no push service. A notification sent from the server would assume infrastructure that does not
 * exist. That leaves Capacitor's local notifications: the operating system keeps the alarm and fires it
 * even with the application closed, without network. It is the only option that keeps the promise.
 *
 * On the web there is none. The browser's Notification API only fires if a page is alive to call
 * `new Notification(...)`; waking a closed tab needs a push service, so a server. So we do nothing at all
 * on the web, and the interface says so — better an absent promise than a broken one.
 */
export type ReminderPermission = 'granted' | 'denied' | 'unsupported';

export function remindersSupported(): boolean {
	return Capacitor.isNativePlatform();
}

/**
 * Asking for permission, and only on a gesture from the person.
 *
 * Android 13 asks for it at runtime, and a refusal is final after twice: asking at launch, before anyone
 * has set a date, would waste the only chance of getting it. A refusal is not an error — the date stays
 * set and displayed, it is the reminder alone that disappears.
 */
export async function requestReminderPermission(): Promise<ReminderPermission> {
	if (!remindersSupported()) return 'unsupported';

	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');

		const current = await LocalNotifications.checkPermissions();
		if (current.display === 'granted') return 'granted';

		const requested = await LocalNotifications.requestPermissions();
		return requested.display === 'granted' ? 'granted' : 'denied';
	} catch {
		return 'unsupported';
	}
}

/**
 * Re-setting all the device's reminders as a whole.
 *
 * We cancel everything then reschedule, rather than keep a log of differences. That is what keeps the
 * rest simple: a changed date, a cleared date, a finished or deleted list, a past date — none of these
 * cases has code of its own, it is enough that the plan no longer contains it.
 *
 * And since it is replayed on every opening, a reinstall or a phone restart, which empty the system's
 * alarms, are caught up at the next launch without asking anything.
 *
 * The cancellation only targets our own ids: the application has no other notification today, but erasing
 * those of a future neighbour would be a quiet trap.
 */
export async function applyReminders(
	plans: ReminderPlan[],
	texts: (plan: ReminderPlan) => { title: string; body: string }
): Promise<void> {
	if (!remindersSupported()) return;

	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');

		// No request here: with no permission we schedule nothing, silently.
		const permission = await LocalNotifications.checkPermissions();
		if (permission.display !== 'granted') return;

		const pending = await LocalNotifications.getPending();
		const prevus = new Set(plans.map((plan) => plan.id));
		// Cook-along timers (#310) are scheduled elsewhere and are not ours to cancel.
		const stale = pending.notifications.filter(
			(notification) =>
				!prevus.has(Number(notification.id)) &&
				(notification.extra as { kind?: string } | undefined)?.kind !== 'timer'
		);
		if (stale.length) await LocalNotifications.cancel({ notifications: stale });

		if (!plans.length) return;

		await LocalNotifications.schedule({
			notifications: plans.map((plan) => {
				const { title, body } = texts(plan);

				return {
					id: plan.id,
					title,
					body,
					// No exact alarm, and that is deliberate. It is the plugin's default, but on Android 12+ it opens
					// the system "Alarms and reminders" screen as soon as it is missing — here, on every opening of
					// the application, without anyone asking. A shopping reminder is quite happy to the nearest
					// minute, and `allowWhileIdle` is enough to get it out of battery saving: delayed by two hours, it
					// would arrive after the shop closed.
					isExactNotification: false,
					schedule: { at: plan.at, allowWhileIdle: true }
				};
			})
		});
	} catch {
		// Plugin absent, channel refused, alarm impossible: the list and its date stay usable.
	}
}
