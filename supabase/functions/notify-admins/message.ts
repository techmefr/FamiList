/**
 * Redaction du courriel groupe envoye aux administrateurs.
 *
 * En francais, alors que l application parle dix langues : ce texte ne s adresse pas aux personnes
 * qui utilisent l application mais a celles qui l administrent, et rien en base ne dit dans quelle
 * langue elles la lisent — `profiles` ne porte aucune colonne de langue, le choix vit dans le
 * `localStorage` du navigateur. Traduire a l aveugle demanderait d inventer une preference; ecrire
 * en francais suit le reste de ce qui ne sort pas de l ecran : les commentaires, les messages de
 * commit et les libelles d administration. Le jour ou une langue d administrateur est stockee,
 * c est ce fichier, et lui seul, qui change.
 *
 * Aucune dependance Deno ici, pour que la mise en forme reste testable par vitest.
 */

export const NOTIFICATION_KINDS = ['signup', 'bug_report'] as const;
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

const plural = (count: number, one: string, many: string): string =>
	`${count} ${count > 1 ? many : one}`;

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

/**
 * Un seul courriel pour tout ce que le tampon contenait, meme quand les deux sortes s y melangent :
 * deux courriels simultanes couteraient a l administrateur la meme attention qu un seul.
 */
export function buildAdminMail(notifications: AdminNotification[], adminUrl: string): AdminMail {
	const signups = notifications.filter((n) => n.kind === 'signup');
	const reports = notifications.filter((n) => n.kind === 'bug_report');

	const headline: string[] = [];
	if (signups.length > 0) headline.push(plural(signups.length, 'inscription', 'inscriptions'));
	if (reports.length > 0) headline.push(plural(reports.length, 'signalement', 'signalements'));

	const body: string[] = [];

	if (signups.length > 0) {
		const title =
			signups.length > 1
				? 'Inscriptions en attente de validation'
				: 'Inscription en attente de validation';
		body.push(title, ...signups.map(describeSignup), '');
	}

	if (reports.length > 0) {
		const title = reports.length > 1 ? 'Nouveaux signalements' : 'Nouveau signalement';
		body.push(title, ...reports.map(describeBugReport), '');
	}

	body.push(`Tout se traite depuis ${adminUrl}`);

	return {
		subject: `Familiste — ${headline.join(', ')}`,
		text: body.join('\n')
	};
}
