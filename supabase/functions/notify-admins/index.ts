/**
 * Envoie aux administrateurs un courriel groupe reprenant le tampon `admin_notifications`.
 *
 * Reveillee par `public.flush_admin_notifications()` (pg_cron, toutes les cinq minutes) : rien ici
 * n est declenche par une action d utilisateur, et rien ici ne peut donc faire echouer une
 * inscription ou un signalement. La fonction repond toujours 200 — une erreur renvoyee ne serait
 * lue par personne, alors qu une ligne relachee sera reprise au tour suivant.
 *
 * Secrets attendus (`supabase secrets set`) : ADMIN_MAIL_SMTP_HOST, ADMIN_MAIL_SMTP_PORT,
 * ADMIN_MAIL_FROM, et le couple ADMIN_MAIL_SMTP_USER / ADMIN_MAIL_SMTP_PASSWORD si le relais
 * demande une authentification. Tant qu ils manquent, la fonction relache ce qu elle a reclame.
 */

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { type AdminNotification, buildAdminMail } from './message.ts';

type ClaimResult = {
	recipients: string[];
	notifications: AdminNotification[];
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
	const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			apikey: SERVICE_KEY,
			Authorization: `Bearer ${SERVICE_KEY}`
		},
		body: JSON.stringify(args)
	});

	if (!response.ok) {
		throw new Error(`${name}: ${response.status} ${await response.text()}`);
	}

	// Une fonction `returns void` repond 204 sans corps : `response.json()` echouerait dessus, et
	// l echec tomberait apres l envoi du courriel — en relachant des lignes deja parties.
	const body = await response.text();

	return (body === '' ? null : JSON.parse(body)) as T;
}

async function send(recipients: string[], subject: string, body: string): Promise<void> {
	const host = Deno.env.get('ADMIN_MAIL_SMTP_HOST');
	const from = Deno.env.get('ADMIN_MAIL_FROM');
	if (!host || !from) throw new Error('SMTP non configure');

	const username = Deno.env.get('ADMIN_MAIL_SMTP_USER');
	const password = Deno.env.get('ADMIN_MAIL_SMTP_PASSWORD');

	const client = new SMTPClient({
		connection: {
			hostname: host,
			port: Number(Deno.env.get('ADMIN_MAIL_SMTP_PORT') ?? '587'),
			// `tls: true` ouvre en SMTPS (465). Sur 587 on part en clair et denomailer eleve par
			// STARTTLS, ce qu exigera tout relais avant de nous laisser nous authentifier. La pile
			// locale, elle, n offre ni TLS ni authentification : d ou la cle `auth` reellement
			// absente quand il n y a pas d identifiants, et non posee a `undefined` — denomailer
			// refuse de s authentifier en clair, et la simple presence de la cle suffit a declencher
			// ce refus.
			tls: Deno.env.get('ADMIN_MAIL_SMTP_PORT') === '465',
			...(username && password ? { auth: { username, password } } : {})
		},
		// Refus par defaut d envoyer sur une liaison restee en clair. Mailpit, le collecteur de la
		// pile locale, ne propose ni TLS ni STARTTLS : sans cette porte, la brique ne serait
		// verifiable nulle part avant la production. Elle ne s ouvre que si on la nomme, et elle
		// n a rien a faire dans les secrets d un projet en ligne.
		debug: { allowUnsecure: Deno.env.get('ADMIN_MAIL_SMTP_ALLOW_INSECURE') === 'true' }
	});

	try {
		await client.send({ from, to: recipients, subject, content: body });
	} finally {
		// `close()` leve quand la connexion n a jamais pu s ouvrir, et masquerait alors la vraie
		// cause de l echec — celle qu on veut voir dans les journaux.
		try {
			await client.close();
		} catch {
			// Deja ferme, ou jamais ouvert.
		}
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

		const adminUrl = `${Deno.env.get('ADMIN_MAIL_APP_URL') ?? 'https://familiste.app'}/admin`;
		const mail = buildAdminMail(notifications, adminUrl);
		await send(recipients, mail.subject, mail.text);

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
