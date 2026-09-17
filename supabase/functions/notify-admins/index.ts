/**
 * Envoie aux administrateurs un courriel groupe reprenant le tampon `admin_notifications`.
 *
 * Reveillee par `public.flush_admin_notifications()` (pg_cron, toutes les cinq minutes) : rien ici
 * n est declenche par une action d utilisateur, et rien ici ne peut donc faire echouer une
 * inscription ou un signalement. La fonction repond toujours 200 — une erreur renvoyee ne serait
 * lue par personne, alors qu une ligne relachee sera reprise au tour suivant.
 *
 * Configuration : les reglages d instance poses depuis `/admin` (#138), avec priorite aux secrets
 * de fonction quand ils existent — ADMIN_MAIL_SMTP_HOST, ADMIN_MAIL_SMTP_PORT, ADMIN_MAIL_FROM et
 * le couple ADMIN_MAIL_SMTP_USER / ADMIN_MAIL_SMTP_PASSWORD. Une instance deja configuree par
 * `supabase secrets set` continue donc sans rien changer. Tant que ni l un ni l autre ne repond,
 * la fonction relache ce qu elle a reclame et le tampon garde tout.
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

		// Le plafond journalier est reclame avant d ouvrir la session, et le refus est une erreur
		// comme une autre : les lignes retournent au tampon et repartiront demain, plutot que d etre
		// marquees envoyees alors que rien n est parti.
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
			// Relachees et non perdues : le prochain reveil les reprendra, et le tampon garde la
			// trace de ce qui n est jamais parti.
			await rpc('release_admin_notifications', { ids: claimed }).catch(() => undefined);
		}

		console.error('notify-admins', error);

		return Response.json({ status: 'failed', error: String(error) });
	}
});
