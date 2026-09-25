import { reminderId } from '$domain/reminder';
import { remindersSupported, requestReminderPermission } from './reminders';

/**
 * The end of a cook-along timer, rung by the phone itself (#310): with the screen off or FamiList in the
 * background, only the operating system can still sound it. On the web there is no such thing; the timer
 * then rings only while the page is open, and the screen says so.
 *
 * These notifications carry `extra.kind = 'timer'` so the list reminders, which cancel every pending
 * notification they did not plan, leave them alone.
 */
export const TIMER_NOTIFICATION_KIND = 'timer';

const notificationId = (timerId: string) => reminderId(`timer:${timerId}`);

export async function scheduleTimerAlarm(timer: { id: string; endsAt: number }, title: string, body: string) {
	if (!remindersSupported()) return;

	try {
		// Asked on the gesture that starts the timer, never before: a refusal still leaves the in-app alarm.
		if ((await requestReminderPermission()) !== 'granted') return;

		const { LocalNotifications } = await import('@capacitor/local-notifications');
		await LocalNotifications.schedule({
			notifications: [
				{
					id: notificationId(timer.id),
					title,
					body,
					extra: { kind: TIMER_NOTIFICATION_KIND },
					// Inexact, like the list reminders: SCHEDULE_EXACT_ALARM is stripped from the manifest. In the
					// background Android may ring a little late; with cook-along open the in-app alarm is on time.
					isExactNotification: false,
					schedule: { at: new Date(timer.endsAt), allowWhileIdle: true }
				}
			]
		});
	} catch {
		// No plugin or no channel: the alarm on screen still rings while the app is open.
	}
}

export async function cancelTimerAlarm(timerId: string) {
	if (!remindersSupported()) return;

	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');
		await LocalNotifications.cancel({ notifications: [{ id: notificationId(timerId) }] });
	} catch {
		// Nothing scheduled, or no plugin: nothing to cancel.
	}
}
