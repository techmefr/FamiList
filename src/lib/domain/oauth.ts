/**
 * Signing in through an external provider. The code is complete for all four providers, but a button only
 * appears if its identifier is in ENABLED_PROVIDERS: Supabase answers "Unsupported provider" for a provider
 * not configured on its side, and a button that always fails is worse than no button at all.
 *
 * Enabling a provider takes two steps, in this order:
 *  1. create the OAuth application at the provider, then paste its identifier and secret into Supabase
 *     (Authentication > Sign In / Providers). The return URL to declare at the provider is
 *     https://<ref>.supabase.co/auth/v1/callback;
 *  2. add its identifier to ENABLED_PROVIDERS here, then redeploy.
 *
 * Microsoft is called "azure" on the Supabase side, which is its former product name.
 */
export type ProviderId = 'google' | 'apple' | 'facebook' | 'azure';

export interface OAuthProvider {
	id: ProviderId;
	/** Brand name, never translated: "Google" is written Google in every language. */
	label: string;
	/**
	 * Scopes requested on top of the default ones. Microsoft does not return the email address without
	 * email, and with no address the trigger creating the profile has nothing to name the person with.
	 */
	scopes?: string;
}

export const OAUTH_PROVIDERS: OAuthProvider[] = [
	{ id: 'google', label: 'Google' },
	{ id: 'apple', label: 'Apple' },
	{ id: 'facebook', label: 'Facebook' },
	{ id: 'azure', label: 'Microsoft', scopes: 'email' }
];

/**
 * The providers actually configured in Supabase. Empty while no OAuth application exists: the sign-in screen
 * then shows only the email form, with no separator.
 */
export const ENABLED_PROVIDERS: ProviderId[] = [];

export function enabledProviders(
	enabled: ProviderId[] = ENABLED_PROVIDERS,
	catalogue: OAuthProvider[] = OAUTH_PROVIDERS
): OAuthProvider[] {
	return catalogue.filter((provider) => enabled.includes(provider.id));
}
