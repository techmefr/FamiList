/**
 * Sends a test email to the administrator who has just clicked, and says what failed.
 *
 * Why this function exists. Real sending is asynchronous and silent: `flush_admin_notifications` wakes
 * `notify-admins` every five minutes, and a failure leaves only a line in logs nobody who is not a developer
 * will go and read. Without this button, the only way of knowing whether the configuration works would be to
 * wait for a stranger to sign up.
 *
 * Why it answers in codes and not in messages. The text shown on screen is translated into ten languages on
 * the client side; returning an English sentence from here would make it untranslatable. The code says the
 * cause, the screen says the sentence.
 *
 * Why the recipient is not in the request. `begin_instance_mail_test()` returns the calling account's
 * address, and it is the only one we serve. A free field would have made this button a sending form for
 * whoever holds a stolen administrator account.
 *
 * What it never returns: the value of a secret setting. The answer carries only the outcome, the public key
 * of the cause, and the address the message left for.
 */

import { diagnoseMailFailure, type MailTestOutcome } from '../_shared/mail-diagnosis.ts';
import { isMailConfigured, loadMailSettings, sendMail } from '../_shared/mail.ts';
import { callRpc } from '../_shared/rpc.ts';
import { buildTestMail } from './message.ts';

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function reply(outcome: MailTestOutcome, extra: Record<string, unknown> = {}): Response {
	return Response.json({ outcome, ...extra }, { headers: CORS });
}

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });

	// The person's token, not the service key: it is the database that checks the role and the second factor,
	// through `assert_admin_write()`. An edge function deciding for itself would be a second place where the
	// rule can diverge.
	const token = request.headers.get('Authorization')?.replace(/^Bearer /i, '') ?? '';
	if (token === '') return reply('failed', { reason: 'missing_token' });

	let recipient: string;

	try {
		recipient = await callRpc<string>('begin_instance_mail_test', {}, token);
	} catch (error) {
		const reason = String(error);

		if (reason.includes('plafond')) return reply('quota');

		// A role or elevation refusal is passed on as it is: the screen already knows how to translate those two
		// messages, it does so for every other write of the panel.
		return reply('failed', { reason });
	}

	const settings = await loadMailSettings();

	if (!isMailConfigured(settings)) return reply('not_configured');

	try {
		const mail = buildTestMail(recipient);
		await sendMail(settings, [recipient], mail.subject, mail.text);
	} catch (error) {
		console.error('test-instance-mail', error);

		return reply(diagnoseMailFailure(String(error)), { recipient });
	}

	return reply('sent', { recipient });
});
