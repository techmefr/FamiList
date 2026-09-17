/**
 * Sends the administrators a grouped email covering the `admin_notifications` buffer.
 *
 * Woken by `public.flush_admin_notifications()` (pg_cron, every five minutes): nothing here is triggered by a
 * user action, and nothing here can therefore make a sign-up or a report fail. The function always answers
 * 200 — an error returned would be read by nobody, whereas a released row will be taken again on the next
 * round.
 *
 * Configuration: the instance settings set from `/admin` (#138), with priority to the function secrets when
 * they exist — ADMIN_MAIL_SMTP_HOST, ADMIN_MAIL_SMTP_PORT, ADMIN_MAIL_FROM and the ADMIN_MAIL_SMTP_USER /
 * ADMIN_MAIL_SMTP_PASSWORD pair. An instance already configured by `supabase secrets set` therefore carries
 * on with no change. While neither answers, the function releases what it has claimed and the buffer keeps
 * everything.
 */

import { isMailConfigured, loadMailSettings, sendMail } from '../_shared/mail.ts';
import { callRpc, serviceKey } from '../_shared/rpc.ts';
import { type AdminNotification, buildAdminMail } from './message.ts';

type ClaimResult = {
	recipients: string[];
	notifications: AdminNotification[];
};

const rpc = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
	callRpc<T>(name, args, serviceKey());

Deno.serve(async () => {
	let claimed: string[] = [];

	try {
		const { recipients, notifications } = await rpc<ClaimResult>('claim_admin_notifications', {});
		if (notifications.length === 0) {
			return Response.json({ status: 'nothing_to_send', recipients: recipients.length });
		}

		claimed = notifications.map((notification) => notification.id);

		const settings = await loadMailSettings();
		if (!isMailConfigured(settings)) throw new Error('SMTP non configure');

		// The daily cap is claimed before opening the session, and the refusal is an error like any other: the
		// rows go back to the buffer and will leave again tomorrow, rather than being marked as sent when nothing
		// has left.
		if (!(await rpc<boolean>('claim_instance_mail', { amount: 1 }))) {
			throw new Error("plafond d envoi journalier atteint");
		}

		const adminUrl = `${Deno.env.get('ADMIN_MAIL_APP_URL') ?? 'https://familiste.app'}/admin`;
		const mail = buildAdminMail(notifications, adminUrl);
		await sendMail(settings, recipients, mail.subject, mail.text);

		await rpc('mark_admin_notifications_sent', { ids: claimed });

		return Response.json({ status: 'sent', notifications: claimed.length });
	} catch (error) {
		if (claimed.length > 0) {
			// Released and not lost: the next wake-up will take them again, and the buffer keeps the trace of what
			// never left.
			await rpc('release_admin_notifications', { ids: claimed }).catch(() => undefined);
		}

		console.error('notify-admins', error);

		return Response.json({ status: 'failed', error: String(error) });
	}
});
