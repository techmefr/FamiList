/**
 * Opening an SMTP session, shared by the grouped sending and by the test button.
 *
 * The test button is only worth anything if it takes exactly the path of the real sending: a test going
 * through its own stack validates its own stack. Same client, same options, same sender.
 */

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { type InstanceConfig, resolveSettings } from './settings.ts';
import { MAIL_SETTING_KEYS, isMailConfigured } from './mail-diagnosis.ts';
import { callRpc, serviceKey } from './rpc.ts';

export type MailSettings = Record<string, string | undefined>;

/**
 * The sending settings: the environment first, the database second, key by key.
 *
 * `instance_config` is only reachable by `service_role`, and the call fails on a database that does not have
 * the migration yet. We then fall back on the environment alone, which was the previous behaviour: a
 * function deployed ahead of the database must not stop sending.
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
 * Sends, or raises.
 *
 * The sender comes from the setting and from nowhere else: no caller chooses it, which takes away from the
 * panel the ability to spoof an address even in the hands of somebody who has no business doing so.
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
			// `tls: true` opens in SMTPS (465). On 587 we start in the clear and denomailer upgrades through
			// STARTTLS, which any relay will require before letting us authenticate. The local stack, for its part,
			// offers neither TLS nor authentication: hence the `auth` key really absent when there are no
			// credentials, and not set to `undefined` — denomailer refuses to authenticate in the clear, and the
			// mere presence of the key is enough to trigger that refusal.
			tls: port === 465,
			...(username && password ? { auth: { username, password } } : {})
		},
		// Refuses by default to send over a link left in the clear. Mailpit, the local stack's collector, offers
		// neither TLS nor STARTTLS: without this door, the piece could not be checked anywhere before production.
		// It only opens if it is named, and it has no business in the secrets of an online project.
		debug: { allowUnsecure: Deno.env.get('ADMIN_MAIL_SMTP_ALLOW_INSECURE') === 'true' }
	});

	try {
		await client.send({ from, to: recipients, subject, content: body });
	} finally {
		// `close()` raises when the connection never managed to open, and would then hide the real cause of the
		// failure — the one we want to see in the logs.
		try {
			await client.close();
		} catch {
			// Already closed, or never opened.
		}
	}
}
