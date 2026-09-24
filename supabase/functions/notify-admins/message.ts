/**
 * Writing the grouped email sent to the administrators.
 *
 * In French, while the application speaks ten languages: this text is not addressed to the people who use
 * the application but to those who administer it, and nothing in the database says which language they read
 * it in — `profiles` carries no language column, and the choice lives in the browser's `localStorage`.
 * Translating blind would mean inventing a preference; writing in French follows the rest of what does not
 * leave the screen: the comments, the commit messages and the administration labels. The day an
 * administrator's language is stored, this file, and it alone, changes.
 *
 * No Deno dependency here, so that the formatting stays testable by vitest.
 */

export const NOTIFICATION_KINDS = ['signup', 'bug_report', 'approved', 'privacy_request'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type AdminNotification = {
	id: string;
	kind: NotificationKind;
	createdAt: string;
	payload: Record<string, unknown>;
};

export type AdminMail = {
	subject: string;
	text: string;
};

const text = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const plural = (count: number, one: string, many: string): string => `${count} ${count > 1 ? many : one}`;

function formatDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;

	return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function describeSignup(notification: AdminNotification): string {
	const name = text(notification.payload.display_name) ?? 'Sans nom';
	const email = text(notification.payload.email) ?? 'adresse inconnue';

	return `- ${name} (${email}) — ${formatDate(notification.createdAt)}`;
}

function describeBugReport(notification: AdminNotification): string {
	const kind = notification.payload.report_kind === 'suggestion' ? 'Suggestion' : 'Bug';
	const email = text(notification.payload.email) ?? 'auteur inconnu';
	const excerpt = text(notification.payload.excerpt) ?? '(sans description)';
	const path = text(notification.payload.path);

	const details = [`- ${kind} de ${email} — ${formatDate(notification.createdAt)}`, `  ${excerpt}`];
	if (path) details.push(`  Page : ${path}`);
	if (notification.payload.has_screenshot === true) details.push('  Capture jointe.');

	return details.join('\n');
}

const PRIVACY_KINDS: Record<string, string> = {
	access: 'Acces',
	rectification: 'Rectification',
	erasure: 'Effacement',
	portability: 'Portabilite',
	objection: 'Opposition',
	restriction: 'Limitation',
	other: 'Autre'
};

function describePrivacyRequest(notification: AdminNotification): string {
	const kind = PRIVACY_KINDS[String(notification.payload.request_kind)] ?? 'Autre';
	const email = text(notification.payload.email) ?? 'adresse inconnue';
	const excerpt = text(notification.payload.excerpt) ?? '(sans message)';

	return [`- ${kind} de ${email} — ${formatDate(notification.createdAt)}`, `  ${excerpt}`].join('\n');
}

/**
 * The one email sent to the person themselves, once their account clears review. Written in French like the
 * rest of what this file sends: `profiles` carries no language column, so there is no preference to honour —
 * see the note at the top of this file.
 */
export function buildApprovalMail(appUrl: string): AdminMail {
	const name = 'FamiList';

	return {
		subject: `${name} — votre compte est valide`,
		text: [
			`Votre compte a ete valide : vous pouvez maintenant vous connecter et retrouver votre foyer.`,
			'',
			appUrl
		].join('\n')
	};
}

/**
 * A single email for everything the buffer held, even when both kinds are mixed in it: two simultaneous
 * emails would cost the administrator the same attention as one.
 */
export function buildAdminMail(notifications: AdminNotification[], adminUrl: string): AdminMail {
	// `approved` rows are routed to the account itself by the caller, never grouped into this one.
	const signups = notifications.filter((n) => n.kind === 'signup');
	const reports = notifications.filter((n) => n.kind === 'bug_report');
	const privacy = notifications.filter((n) => n.kind === 'privacy_request');

	const headline: string[] = [];
	if (signups.length > 0) headline.push(plural(signups.length, 'inscription', 'inscriptions'));
	if (reports.length > 0) headline.push(plural(reports.length, 'signalement', 'signalements'));
	if (privacy.length > 0) headline.push(plural(privacy.length, 'demande RGPD', 'demandes RGPD'));

	const body: string[] = [];

	if (signups.length > 0) {
		const title =
			signups.length > 1 ? 'Inscriptions en attente de validation' : 'Inscription en attente de validation';
		body.push(title, ...signups.map(describeSignup), '');
	}

	if (reports.length > 0) {
		const title = reports.length > 1 ? 'Nouveaux signalements' : 'Nouveau signalement';
		body.push(title, ...reports.map(describeBugReport), '');
	}

	if (privacy.length > 0) {
		const title = privacy.length > 1 ? 'Nouvelles demandes RGPD' : 'Nouvelle demande RGPD';
		body.push(title, ...privacy.map(describePrivacyRequest), 'Delai legal de reponse : un mois.', '');
	}

	body.push(`Tout se traite depuis ${adminUrl}`);

	return {
		subject: `Familiste — ${headline.join(', ')}`,
		text: body.join('\n')
	};
}
