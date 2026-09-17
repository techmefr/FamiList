/**
 * What a sending failure means, as a cause and not as a stack trace.
 *
 * The test button is only of interest if it tells the causes apart: each is fixed somewhere else. An
 * authentication refusal is fixed in the password field; an unreachable host, in the server field or at the
 * host; an unverified sender, on the provider's dashboard, and nowhere in this screen. Returning "SMTP
 * error" for all three would send two thirds of people looking in the wrong place.
 *
 * The unverified sender deserves its own case because it is the most frequent failure: Brevo, Sendgrid,
 * Mailgun and the others accept the connection, accept the password, then refuse the message because the
 * sending address has never been proved to them. Seen from the terminal, it is a 550 in the middle of a
 * successful session; seen from the screen, it is "everything is fine and yet nothing leaves".
 *
 * The classification reads the error text, for want of better: denomailer does not return the response code
 * separately. So we read the three-digit code when it is there, and the usual turns of phrase otherwise.
 */

export type MailTestOutcome =
	| 'sent'
	| 'not_configured'
	| 'auth_refused'
	| 'unreachable'
	| 'sender_rejected'
	| 'quota'
	| 'failed';

const AUTH_HINTS = [
	'535',
	'534',
	'530',
	'authentication',
	'auth failed',
	'authentification',
	'invalid login',
	'username and password',
	'bad credentials'
];

const UNREACHABLE_HINTS = [
	'connection refused',
	'connectionrefused',
	'dns error',
	'failed to lookup',
	'name or service not known',
	'network is unreachable',
	'connection reset',
	'timed out',
	'timeout',
	'econnrefused',
	'enotfound',
	'no route to host',
	'connection closed before',
	'tls'
];

const SENDER_HINTS = [
	'not verified',
	'unverified',
	'verify your',
	'sender address',
	'sender not',
	'from address',
	'domain is not',
	'not allowed to send',
	'unauthorized sender',
	'does not match a verified',
	'mail from',
	'sender rejected',
	'expediteur'
];

const SENDER_CODES = ['550', '553', '554', '551', '501'];

/**
 * Order matters. A sender refusal often arrives in a message that also contains the word "authentication"
 * ("sender not verified, see authentication docs"): tested last, it would be read as a wrong password, and
 * the person would change a password that was working.
 */
export function diagnoseMailFailure(reason: string): MailTestOutcome {
	const text = reason.toLowerCase();

	if (SENDER_HINTS.some((hint) => text.includes(hint))) return 'sender_rejected';

	if (SENDER_CODES.some((code) => text.includes(code)) && text.includes('from')) {
		return 'sender_rejected';
	}

	if (AUTH_HINTS.some((hint) => text.includes(hint))) return 'auth_refused';

	if (UNREACHABLE_HINTS.some((hint) => text.includes(hint))) return 'unreachable';

	return 'failed';
}

/** The setting keys sending needs, and those without which it attempts nothing. */
export const MAIL_SETTING_KEYS = [
	'mail_smtp_host',
	'mail_smtp_port',
	'mail_smtp_user',
	'mail_smtp_password',
	'mail_from'
] as const;

export const MAIL_REQUIRED_KEYS = ['mail_smtp_host', 'mail_from'] as const;

/**
 * True when sending has enough to attempt something.
 *
 * The host and the sender are enough: a local relay does not require credentials, and demanding a password
 * here would rule out the development stack and internal relays.
 */
export function isMailConfigured(settings: Record<string, string | undefined>): boolean {
	return MAIL_REQUIRED_KEYS.every((key) => {
		const value = settings[key];
		return value !== undefined && value.trim() !== '';
	});
}
