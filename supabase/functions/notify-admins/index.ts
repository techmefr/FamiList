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
import { type AdminNotification, buildAdminMail, buildApprovalMail } from './message.ts';

type ClaimResult = {
	recipients: string[];
	notifications: AdminNotification[];
};

const rpc = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
	callRpc<T>(name, args, serviceKey());

/** One SMTP send costs one slot of the daily cap; a refusal is an error like any other send failure. */
async function claimSendOrThrow(): Promise<void> {
	if (!(await rpc<boolean>('claim_instance_mail', { amount: 1 }))) {
		throw new Error('plafond d envoi journalier atteint');
	}
}

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

		// `approved` notifications go one by one to the account itself; everything else is still the
		// administrators' single grouped email.
		const approvals = notifications.filter((notification) => notification.kind === 'approved');
		const rest = notifications.filter((notification) => notification.kind !== 'approved');

		const appUrl = Deno.env.get('ADMIN_MAIL_APP_URL') ?? 'https://familiste.app';
		const sentIds: string[] = [];

		for (const approval of approvals) {
			const email = approval.payload.email;
			if (typeof email !== 'string' || email.trim() === '') continue;

			await claimSendOrThrow();
			const mail = buildApprovalMail(appUrl);
			await sendMail(settings, [email], mail.subject, mail.text);
			sentIds.push(approval.id);
		}

		if (rest.length > 0) {
			await claimSendOrThrow();
			const mail = buildAdminMail(rest, `${appUrl}/admin`);
			await sendMail(settings, recipients, mail.subject, mail.text);
			sentIds.push(...rest.map((notification) => notification.id));
		}

		await rpc('mark_admin_notifications_sent', { ids: sentIds });

		const unsent = claimed.filter((id) => !sentIds.includes(id));
		if (unsent.length > 0) await rpc('release_admin_notifications', { ids: unsent }).catch(() => undefined);

		return Response.json({ status: 'sent', notifications: sentIds.length });
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
