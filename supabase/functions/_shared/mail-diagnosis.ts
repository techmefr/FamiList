/**
 * Ce qu un echec d envoi veut dire, en une cause et pas en une trace.
 *
 * Le bouton de test n a d interet que s il distingue les causes : chacune se repare ailleurs. Un
 * refus d authentification se corrige dans le champ mot de passe ; un hote injoignable, dans le
 * champ serveur ou chez l hebergeur ; un expediteur non verifie, sur le tableau de bord du
 * fournisseur, et nulle part dans cet ecran. Rendre « erreur SMTP » aux trois renverrait les deux
 * tiers des gens chercher au mauvais endroit.
 *
 * L expediteur non verifie merite son propre cas parce que c est la panne la plus frequente :
 * Brevo, Sendgrid, Mailgun et les autres acceptent la connexion, acceptent le mot de passe, puis
 * refusent le message parce que l adresse d expedition ne leur a jamais ete prouvee. Vu du
 * terminal, c est un 550 au milieu d une session reussie ; vu de l ecran, c est « tout est bon et
 * pourtant rien ne part ».
 *
 * La classification lit le texte de l erreur, faute de mieux : denomailer ne rend pas le code de
 * reponse separement. On lit donc le code a trois chiffres quand il est la, et les tournures
 * habituelles sinon.
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
 * Le rang compte. Un refus d expediteur arrive souvent dans un message qui contient aussi le mot
 * « authentication » (« sender not verified, see authentication docs ») : teste en dernier, il
 * serait lu comme un mot de passe faux, et la personne changerait un mot de passe qui marchait.
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

/** Les cles de reglage dont l envoi a besoin, et celles sans lesquelles il ne tente rien. */
export const MAIL_SETTING_KEYS = [
	'mail_smtp_host',
	'mail_smtp_port',
	'mail_smtp_user',
	'mail_smtp_password',
	'mail_from'
] as const;

export const MAIL_REQUIRED_KEYS = ['mail_smtp_host', 'mail_from'] as const;

/**
 * Vrai quand l envoi a de quoi tenter quelque chose.
 *
 * L hote et l expediteur suffisent : un relais local n exige pas d identifiants, et exiger un mot
 * de passe ici interdirait la pile de developpement et les relais internes.
 */
export function isMailConfigured(settings: Record<string, string | undefined>): boolean {
	return MAIL_REQUIRED_KEYS.every((key) => {
		const value = settings[key];
		return value !== undefined && value.trim() !== '';
	});
}
