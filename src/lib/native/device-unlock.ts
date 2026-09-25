import { Capacitor } from '@capacitor/core';
import { isPrfOutput, type PasskeyUnlock } from '$domain/offline-secret';

/**
 * The browser side of the phone's own unlock (#328).
 *
 * Only a user-verifying platform authenticator counts: the fingerprint reader, the face camera or the
 * device PIN behind them. The installed app answers "no" for now: its WebView serves the page from
 * `localhost`, a domain no passkey can belong to, and Android's WebView does not expose WebAuthn anyway. It
 * keeps the authenticator code, which works there unchanged.
 */

const FACTOR_KEY = 'familist:device-factor';

/**
 * A passkey is bound to a domain name. Served from a bare IP address (a LAN self-host, the dev server on
 * 127.0.0.1) every ceremony would fail with a SecurityError, so the option is not offered at all.
 */
const IP_HOST = /^(\d{1,3}\.){3}\d{1,3}$|^\[/;

export async function deviceUnlockAvailable(): Promise<boolean> {
	if (typeof window === 'undefined' || typeof window.PublicKeyCredential === 'undefined') return false;
	if (Capacitor.isNativePlatform() || IP_HOST.test(location.hostname)) return false;
	try {
		return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
	} catch {
		return false;
	}
}

/**
 * The factor enrolled from this device, so that sign-in and reveal ask for the right credential. A hint
 * only: forgetting it costs one more choice on screen, never access.
 */
export function rememberedDeviceFactor(): string | null {
	try {
		return localStorage.getItem(FACTOR_KEY);
	} catch {
		return null;
	}
}

export function rememberDeviceFactor(id: string | null) {
	try {
		if (id) localStorage.setItem(FACTOR_KEY, id);
		else localStorage.removeItem(FACTOR_KEY);
	} catch {
		// private window or blocked storage: the list on screen still lets the person pick
	}
}

const randomChallenge = () => crypto.getRandomValues(new Uint8Array(new ArrayBuffer(32)));

/**
 * Asks the passkey for its PRF output under `salt`, behind the phone's unlock. The challenge is local and
 * never checked by anyone: this ceremony proves nothing to the server, it only derives the key that
 * opens the offline copy. `null` when the person cancels or the authenticator has no PRF.
 */
export async function passkeyPrf(
	salt: Uint8Array<ArrayBuffer>,
	credentialId?: ArrayBuffer
): Promise<{ unlock: PasskeyUnlock; output: ArrayBuffer } | null> {
	try {
		const credential = (await navigator.credentials.get({
			publicKey: {
				challenge: randomChallenge(),
				rpId: location.hostname,
				userVerification: 'required',
				allowCredentials: credentialId ? [{ type: 'public-key', id: credentialId }] : [],
				extensions: { prf: { eval: { first: salt } } }
			}
		})) as PublicKeyCredential | null;

		const output = credential?.getClientExtensionResults().prf?.results?.first;
		if (!credential || !(output instanceof ArrayBuffer) || !isPrfOutput(output)) return null;

		return { unlock: { credentialId: credential.rawId, salt }, output };
	} catch {
		return null;
	}
}
