import { createClient } from '@supabase/supabase-js';
import { readInstanceConfig, resolveInstanceConfig } from '$domain/instance-config';
import { loadLocalInstanceConfig } from './local-instance-config';
import type { Database } from './types';

/**
 * What the app talks to: whatever was saved from the in-app connection screen on this device, or failing
 * that what `config.js` said when the page opened. Read once, at load time — the client below is built
 * from it immediately after, and changing the connection takes a reload, the same way changing `config.js`
 * already did.
 */
const instanceConfig = resolveInstanceConfig(
	readInstanceConfig(globalThis.__FAMILIST_CONFIG__),
	loadLocalInstanceConfig()
);

export const isConfigured = instanceConfig !== null;

/** DSN Sentry propre a cette instance, ou null si l'installateur n'en a defini aucun. */
export const sentryDsn = instanceConfig?.sentryDsn ?? null;

/**
 * Single client, browser side only (the app is a static SPA, there is no server). The publishable key is
 * made to be delivered to the client: it is RLS that protects the data, not the secrecy of the key.
 *
 * Built even when nothing is configured, on an address that resolves nowhere: `createClient` refuses an
 * empty URL, and this module is imported by every store at load time. Failing here would turn a missing
 * variable into a blank page, whereas the layout reads `isConfigured` and says what is missing. Nothing
 * calls this client in that state — the layout shows the setup screen instead of the app.
 */
export const supabase = createClient<Database>(
	instanceConfig?.url ?? 'http://unconfigured.invalid',
	instanceConfig?.anonKey ?? 'unconfigured',
	{
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true
		}
	}
);
