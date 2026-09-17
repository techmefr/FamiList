/**
 * Les réglages d'instance vus de l'écran : quels champs, lesquels sont secrets, et où on en est.
 *
 * Un porte-réglages et non une page de courriel. #137 a le même besoin pour son jeton de suivi de
 * dépôt, et les suivants en auront d'autres : la liste ci-dessous est le seul endroit à toucher
 * pour en ajouter un, l'écran se déduit d'elle.
 *
 * Ce module ne sait rien de Supabase : il ne fait que décrire et interpréter, ce qui le rend
 * testable sans base ni navigateur.
 */

export type SettingGroup = 'mail' | 'tracker';

export type SettingField = {
	key: string;
	group: SettingGroup;
	isSecret: boolean;
	/** Le clavier attendu, pour que le port n'ouvre pas un clavier alphabétique sur téléphone. */
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
 * Ce qu'on met dans le champ à l'ouverture.
 *
 * Une valeur en clair revient telle quelle : on la relit, on la corrige. Un secret revient vide,
 * jamais en points-de-suspension qu'on prendrait pour sa vraie longueur — la base ne le rend pas,
 * et l'écran n'a rien à inventer. C'est l'étiquette à côté qui dit qu'il est posé.
 */
export function initialValue(row: SettingRow | undefined): string {
	if (!row || row.is_secret) return '';

	return row.value ?? '';
}

/**
 * Vrai quand rien ne partira.
 *
 * L'hôte et l'expéditeur suffisent à tenter un envoi : un relais local n'exige pas d'identifiants.
 * La même règle que la fonction edge, écrite deux fois parce que les deux couches ne partagent pas
 * de code — mais couverte des deux côtés, et c'est ce qui la tient alignée.
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
 * La clé de traduction du verdict.
 *
 * Une issue inconnue retombe sur `failed` plutôt que d'afficher une clé crue : une fonction edge
 * déployée en avance sur le bundle ne doit pas écrire « instance.mailTest.bidule » à l'écran.
 */
export function mailTestKey(outcome: string | null | undefined): string {
	const known = OUTCOMES.find((candidate) => candidate === outcome) ?? 'failed';

	return `instance.mailTest.${known}`;
}

/** L'issue est-elle une réussite ? Le ton du message en dépend, pas seulement son texte. */
export const isMailTestSuccess = (outcome: string | null | undefined): boolean => outcome === 'sent';
