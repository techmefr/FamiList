/**
 * Les reglages d instance vus d une fonction edge : l environnement d abord, la base ensuite.
 *
 * L ordre n est pas arbitraire. Une instance deja configuree par `supabase secrets set` — celle du
 * depot, entre autres — tournait bien avant que `/admin` sache ecrire quoi que ce soit, et une
 * migration ne doit pas la casser. Cle par cle, un secret de fonction pose l emporte donc sur la
 * base ; une cle absente de l environnement retombe sur ce que l ecran a ecrit. Rien a migrer pour
 * qui n a rien a changer, et rien a installer pour qui part de zero.
 *
 * Le choix se fait cle par cle et non par bloc : un bloc « tout l environnement ou tout la base »
 * ferait disparaitre silencieusement un port pose a l ecran des qu un hote traine dans
 * l environnement.
 */

export type InstanceConfig = Record<string, string>;

/** Le nom de la variable d environnement historique, en face de la cle du catalogue. */
export const SETTING_ENV: Record<string, string> = {
	mail_smtp_host: 'ADMIN_MAIL_SMTP_HOST',
	mail_smtp_port: 'ADMIN_MAIL_SMTP_PORT',
	mail_smtp_user: 'ADMIN_MAIL_SMTP_USER',
	mail_smtp_password: 'ADMIN_MAIL_SMTP_PASSWORD',
	mail_from: 'ADMIN_MAIL_FROM',
	issue_tracker_repo: 'ISSUE_TRACKER_REPO',
	issue_tracker_api: 'ISSUE_TRACKER_API',
	issue_tracker_token: 'ISSUE_TRACKER_TOKEN'
};

/**
 * La valeur retenue pour une cle.
 *
 * Une variable posee mais vide ne compte pas : `supabase secrets set X=` laisse une chaine vide, et
 * la prendre pour une configuration ferait echouer l envoi au lieu de retomber sur la base.
 */
export function pickSetting(
	key: string,
	env: Record<string, string | undefined>,
	stored: InstanceConfig
): string | undefined {
	const fromEnv = env[SETTING_ENV[key] ?? key];
	if (fromEnv !== undefined && fromEnv.trim() !== '') return fromEnv;

	const fromStore = stored[key];

	return fromStore !== undefined && fromStore.trim() !== '' ? fromStore : undefined;
}

/** Toutes les cles connues resolues d un coup, pour un appelant qui en lit plusieurs. */
export function resolveSettings(
	keys: readonly string[],
	env: Record<string, string | undefined>,
	stored: InstanceConfig
): InstanceConfig {
	const resolved: InstanceConfig = {};

	for (const key of keys) {
		const value = pickSetting(key, env, stored);
		if (value !== undefined) resolved[key] = value;
	}

	return resolved;
}
