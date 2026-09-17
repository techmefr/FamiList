/**
 * The instance settings as the screen sees them: which fields, which are secret, and where things stand.
 *
 * A settings holder and not an email page. #137 has the same need for its repository tracking token, and
 * the next ones will have others: the list below is the only place to touch to add one, the screen is
 * derived from it.
 *
 * This module knows nothing about Supabase: it only describes and interprets, which makes it testable
 * without a database or a browser.
 */

export type SettingGroup = 'mail' | 'tracker';

export type SettingField = {
	key: string;
	group: SettingGroup;
	isSecret: boolean;
	/** The keyboard expected, so that the port does not open an alphabetic keyboard on a phone. */
	kind: 'text' | 'email' | 'number' | 'password';
};

export const SETTING_FIELDS: readonly SettingField[] = [
	{ key: 'mail_smtp_host', group: 'mail', isSecret: false, kind: 'text' },
	{ key: 'mail_smtp_port', group: 'mail', isSecret: false, kind: 'number' },
	{ key: 'mail_smtp_user', group: 'mail', isSecret: false, kind: 'text' },
	{ key: 'mail_smtp_password', group: 'mail', isSecret: true, kind: 'password' },
	{ key: 'mail_from', group: 'mail', isSecret: false, kind: 'email' },
	{ key: 'issue_tracker_repo', group: 'tracker', isSecret: false, kind: 'text' },
	{ key: 'issue_tracker_api', group: 'tracker', isSecret: false, kind: 'text' },
	{ key: 'issue_tracker_token', group: 'tracker', isSecret: true, kind: 'password' }
];

export type SettingRow = {
	key: string;
	value: string | null;
	is_secret: boolean;
	is_set: boolean;
	updated_at: string | null;
};

export const fieldsOf = (group: SettingGroup): SettingField[] =>
	SETTING_FIELDS.filter((field) => field.group === group);

/**
 * What we put in the field on opening.
 *
 * A plain value comes back as it is: you read it again, you correct it. A secret comes back empty, never as
 * dots that would be taken for its real length — the database does not return it, and the screen has
 * nothing to invent. It is the label beside it that says it is set.
 */
export function initialValue(row: SettingRow | undefined): string {
	if (!row || row.is_secret) return '';

	return row.value ?? '';
}

/**
 * True when nothing will leave.
 *
 * The host and the sender are enough to attempt a send: a local relay does not require credentials. The
 * same rule as the edge function, written twice because the two layers share no code — but covered on both
 * sides, and that is what keeps it aligned.
 */
export function isMailConfigured(rows: SettingRow[]): boolean {
	const set = (key: string) => {
		const row = rows.find((candidate) => candidate.key === key);
		return !!row && row.is_set;
	};

	return set('mail_smtp_host') && set('mail_from');
}

export type MailTestOutcome =
	| 'sent'
	| 'not_configured'
	| 'auth_refused'
	| 'unreachable'
	| 'sender_rejected'
	| 'quota'
	| 'failed';

const OUTCOMES: readonly MailTestOutcome[] = [
	'sent',
	'not_configured',
	'auth_refused',
	'unreachable',
	'sender_rejected',
	'quota',
	'failed'
];

/**
 * The verdict's translation key.
 *
 * An unknown outcome falls back on `failed` rather than showing a raw key: an edge function deployed ahead
 * of the bundle must not write "instance.mailTest.whatsit" on the screen.
 */
export function mailTestKey(outcome: string | null | undefined): string {
	const known = OUTCOMES.find((candidate) => candidate === outcome) ?? 'failed';

	return `instance.mailTest.${known}`;
}

/** Is the outcome a success? The tone of the message depends on it, not only its text. */
export const isMailTestSuccess = (outcome: string | null | undefined): boolean => outcome === 'sent';
