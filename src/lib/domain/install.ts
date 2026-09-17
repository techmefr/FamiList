/**
 * When to offer to install the application, and to whom.
 *
 * Nothing here touches the browser: capturing `beforeinstallprompt`, detecting standalone mode and the
 * storage live in `$stores/install`. What is decided here — is this the right moment, is the refusal
 * still valid, which installation path exists on this device — can be verified without a browser, and
 * that is precisely the part we do not want to see drift.
 */

/**
 * The number of openings before offering anything.
 *
 * On the first visit, nobody yet knows whether they like the application; asking them to put it on their
 * home screen amounts to asking for a commitment before the first service rendered. Three openings is not
 * a measure of enthusiasm, but it is already somebody who came back on their own — twice.
 */
export const MIN_OPENINGS = 3;

/**
 * How long a refusal is held as given: six months.
 *
 * A prompt that comes back on every visit is a nuisance, and a nuisance ends up making you close the tab
 * rather than install the application. Six months leave room for a real change of mind — a new season of
 * use, a new phone — without ever looking like harassment.
 */
export const REFUSAL_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * Which way installation goes on this device.
 *
 * `prompt`: the browser offered `beforeinstallprompt`, we can open the system prompt.
 * `ios`: nothing to trigger, the gesture belongs to Safari — we explain it in words.
 * `none`: no honest path, we stay quiet rather than promise a button that will do nothing.
 */
export type InstallRoute = 'prompt' | 'ios' | 'none';

export interface InstallContext {
	/** The Capacitor shell: the application is already installed, there is nothing to offer. */
	isNative: boolean;
	/** Already launched from the home screen — `display-mode: standalone`. */
	isInstalled: boolean;
	route: InstallRoute;
	openings: number;
	/** Date of the last refusal, in milliseconds, or `null` if we never asked anything. */
	refusedAt: number | null;
	now: number;
}

/**
 * iOS never emits `beforeinstallprompt`, and will not: on iPhone and iPad, adding to the home screen is
 * a Safari gesture, not an API.
 *
 * Since iPadOS 13, an iPad presents itself as a Macintosh; the number of touch points is the only
 * remaining way to tell it from a real Mac, where the Share menu does not offer that gesture.
 *
 * Third-party browsers on iOS are left out: they do borrow WebKit, but their share menu does not carry
 * "Add to Home Screen". Giving them Safari's steps would send them looking for a button that does not
 * exist.
 */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
	const isApple = /iPhone|iPod|iPad/.test(userAgent);
	const isIpadOnDesktopUa = /Macintosh/.test(userAgent) && maxTouchPoints > 1;
	if (!isApple && !isIpadOnDesktopUa) return false;

	// Chrome, Firefox, Edge and Opera on iOS, recognisable by their suffix.
	return !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//.test(userAgent);
}

export function installRoute(hasPrompt: boolean, isIos: boolean): InstallRoute {
	if (hasPrompt) return 'prompt';
	if (isIos) return 'ios';
	return 'none';
}

/** An expired refusal becomes a question we are allowed to ask again. */
export function isRefusalExpired(refusedAt: number | null, now: number): boolean {
	if (refusedAt === null) return true;

	// A clock set back would make the refusal date eternally "in the future": we then treat it as a brand
	// new refusal rather than an expired one.
	if (refusedAt > now) return false;

	return now - refusedAt >= REFUSAL_MS;
}

export function shouldOffer(context: InstallContext): boolean {
	if (context.isNative || context.isInstalled) return false;
	if (context.route === 'none') return false;
	if (context.openings < MIN_OPENINGS) return false;

	return isRefusalExpired(context.refusedAt, context.now);
}

/**
 * The explanation stays reachable from the help menu even when the banner stays quiet: somebody who said
 * "later" a month ago must be able to come back on their own, without waiting six months. Only the "no
 * path" case really disappears — and the already-installed application, which has nothing left to learn
 * about it.
 */
export function canExplain(context: Pick<InstallContext, 'isNative' | 'isInstalled' | 'route'>) {
	return !context.isNative && !context.isInstalled && context.route !== 'none';
}
