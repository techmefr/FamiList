/**
 * The instance settings as seen from an edge function: the environment first, the database second.
 *
 * The order is not arbitrary. An instance already configured by `supabase secrets set` — the repository's,
 * among others — was running well before `/admin` could write anything, and a migration must not break it.
 * Key by key, a function secret that is set therefore wins over the database; a key absent from the
 * environment falls back on what the screen has written. Nothing to migrate for whoever has nothing to
 * change, and nothing to install for whoever starts from scratch.
 *
 * The choice is made key by key and not as a block: an "all environment or all database" block would
 * silently make a port set on screen disappear as soon as a host was lying around in the environment.
 */

export type InstanceConfig = Record<string, string>;

/** The name of the historical environment variable, opposite the catalogue key. */
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
 * The value kept for a key.
 *
 * A variable that is set but empty does not count: `supabase secrets set X=` leaves an empty string, and
 * taking it for a configuration would make sending fail instead of falling back on the database.
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

/** Every known key resolved at once, for a caller reading several of them. */
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
