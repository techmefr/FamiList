/**
 * L ouverture d une session SMTP, partagee par l envoi groupe et par le bouton de test.
 *
 * Le bouton de test ne vaut que s il emprunte exactement le chemin de l envoi reel : un test qui
 * passe par sa propre pile valide sa propre pile. Meme client, memes options, meme expediteur.
 */

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { type InstanceConfig, resolveSettings } from './settings.ts';
import { MAIL_SETTING_KEYS, isMailConfigured } from './mail-diagnosis.ts';
import { callRpc, serviceKey } from './rpc.ts';

export type MailSettings = Record<string, string | undefined>;

/**
 * Les reglages d envoi : l environnement d abord, la base ensuite, cle par cle.
 *
 * `instance_config` n est joignable que par `service_role`, et l appel echoue sur une base qui n a
 * pas encore la migration. On retombe alors sur l environnement seul, ce qui etait le comportement
 * d avant : une fonction deployee en avance sur la base ne doit pas cesser d envoyer.
 */
export async function loadMailSettings(): Promise<MailSettings> {
	let stored: InstanceConfig = {};

	try {
		stored = (await callRpc<InstanceConfig>('instance_config', {}, serviceKey())) ?? {};
	} catch (error) {
		console.warn('instance_config indisponible', error);
	}

	return resolveSettings(MAIL_SETTING_KEYS, Deno.env.toObject(), stored);
}

export { isMailConfigured };

/**
 * Envoie, ou leve.
 *
 * L expediteur vient du reglage et de nulle part ailleurs : aucun appelant ne le choisit, ce qui
 * retire au panneau la capacite d usurper une adresse meme entre les mains de quelqu un qui n y a
 * rien a faire.
 */
export async function sendMail(
	settings: MailSettings,
	recipients: string[],
	subject: string,
	body: string
): Promise<void> {
	const host = settings.mail_smtp_host;
	const from = settings.mail_from;
	if (!host || !from) throw new Error('SMTP non configure');

	const port = Number(settings.mail_smtp_port ?? '587');
	const username = settings.mail_smtp_user;
	const password = settings.mail_smtp_password;

	const client = new SMTPClient({
		connection: {
			hostname: host,
			port,
			// `tls: true` ouvre en SMTPS (465). Sur 587 on part en clair et denomailer eleve par
			// STARTTLS, ce qu exigera tout relais avant de nous laisser nous authentifier. La pile
			// locale, elle, n offre ni TLS ni authentification : d ou la cle `auth` reellement absente
			// quand il n y a pas d identifiants, et non posee a `undefined` — denomailer refuse de
			// s authentifier en clair, et la simple presence de la cle suffit a declencher ce refus.
			tls: port === 465,
			...(username && password ? { auth: { username, password } } : {})
		},
		// Refus par defaut d envoyer sur une liaison restee en clair. Mailpit, le collecteur de la
		// pile locale, ne propose ni TLS ni STARTTLS : sans cette porte, la brique ne serait
		// verifiable nulle part avant la production. Elle ne s ouvre que si on la nomme, et elle n a
		// rien a faire dans les secrets d un projet en ligne.
		debug: { allowUnsecure: Deno.env.get('ADMIN_MAIL_SMTP_ALLOW_INSECURE') === 'true' }
	});

	try {
		await client.send({ from, to: recipients, subject, content: body });
	} finally {
		// `close()` leve quand la connexion n a jamais pu s ouvrir, et masquerait alors la vraie cause
		// de l echec — celle qu on veut voir dans les journaux.
		try {
			await client.close();
		} catch {
			// Deja ferme, ou jamais ouvert.
		}
	}
}
