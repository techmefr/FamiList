import { browser } from '$app/environment';
import { Capacitor } from '@capacitor/core';
import {
	canExplain,
	canOfferManualInstall,
	installRoute,
	isIosSafari,
	shouldOffer
} from '$domain/install';

/**
 * The install prompt of Chrome and Edge. It is not in the type library: the specification is only carried
 * by those browsers.
 */
interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * The opening counter and the refusal date, on the device.
 *
 * `localStorage` and not `@capacitor/preferences`, although both exist in the project: the question only
 * arises on the web, where Preferences is in any case just an asynchronous wrapper around
 * `localStorage`. The read serves the first render, and an asynchronous round trip would make the banner
 * appear afterwards, under the finger of somebody aiming at something else. These two values also belong
 * to the browser itself — installing FamiList in Chrome says nothing about Firefox — so neither the
 * database nor the synced preferences.
 */
const STORAGE_KEY = 'familist:install';

interface Stored {
	openings: number;
	refusedAt: number | null;
}

function read(): Stored {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');

		return {
			openings: typeof saved.openings === 'number' ? saved.openings : 0,
			refusedAt: typeof saved.refusedAt === 'number' ? saved.refusedAt : null
		};
	} catch {
		return { openings: 0, refusedAt: null };
	}
}

class InstallStore {
	#prompt = $state<BeforeInstallPromptEvent | null>(null);
	#openings = $state(0);
	#refusedAt = $state<number | null>(null);
	#isNative = $state(false);
	#isIos = $state(false);
	#isInstalled = $state(false);
	#ready = $state(false);

	/**
	 * The time frozen at startup. A `Date.now()` read inside a `$derived` would not be reactive, and above
	 * all: nobody needs to see the banner reappear the second a refusal expires, mid-session.
	 */
	#startedAt = Date.now();

	/** The banner, put away for this session without that being a refusal yet. */
	dismissed = $state(false);

	/** The explanation, opened from the banner or from the help menu. */
	detailsOpen = $state(false);

	route = $derived(installRoute(this.#prompt !== null, this.#isIos));

	/** True when the install gesture belongs to Safari and is told in words. */
	isManual = $derived(this.route === 'ios');

	canExplain = $derived(
		this.#ready &&
			canExplain({
				isNative: this.#isNative,
				isInstalled: this.#isInstalled,
				route: this.route
			})
	);

	offers = $derived(
		this.#ready &&
			!this.dismissed &&
			shouldOffer({
				isNative: this.#isNative,
				isInstalled: this.#isInstalled,
				route: this.route,
				openings: this.#openings,
				refusedAt: this.#refusedAt,
				now: this.#startedAt
			})
	);

	/**
	 * The always-visible fallback shown in the profile page, regardless of openings or a past refusal —
	 * see `canOfferManualInstall`.
	 */
	canInstallManually = $derived(
		this.#ready &&
			canOfferManualInstall({ isNative: this.#isNative, isInstalled: this.#isInstalled })
	);

	/**
	 * One more opening on the counter, and the listener for the browser prompt.
	 *
	 * `beforeinstallprompt` only passes once: without capturing it, the prompt is lost for the whole session
	 * and the button would have nothing left to trigger. Hence the listener set at startup, long before the
	 * banner is allowed to show.
	 */
	init() {
		if (!browser || this.#ready) return;

		this.#isNative = Capacitor.isNativePlatform();
		if (this.#isNative) {
			this.#ready = true;
			return;
		}

		const stored = read();
		this.#openings = stored.openings + 1;
		this.#refusedAt = stored.refusedAt;
		this.#save();

		this.#isIos = isIosSafari(navigator.userAgent, navigator.maxTouchPoints);
		this.#isInstalled = this.#detectInstalled();

		window.addEventListener('beforeinstallprompt', (event) => {
			// Without this, Chrome shows its own install bar: two offers for the same thing, one of which knows
			// nothing about what the application brings.
			event.preventDefault();
			this.#prompt = event as BeforeInstallPromptEvent;
		});

		// Installation can also come from elsewhere — the browser menu. The banner must disappear without
		// waiting for a reload.
		window.addEventListener('appinstalled', () => {
			this.#prompt = null;
			this.#isInstalled = true;
		});

		this.#ready = true;
	}

	#detectInstalled(): boolean {
		// `navigator.standalone` is specific to iOS and absent from the DOM types.
		const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;

		return matchMedia('(display-mode: standalone)').matches || iosStandalone;
	}

	#save() {
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({ openings: this.#openings, refusedAt: this.#refusedAt })
			);
		} catch {
			// Storage refused — private browsing, quota full. The offer will come back at the next opening:
			// annoying, never blocking.
		}
	}

	/**
	 * Opens the browser prompt.
	 *
	 * The event does not replay: accepted or refused, it is consumed, and we forget it. A refusal taken
	 * there is a real refusal — it counts as the banner's, otherwise the same question would come back at
	 * the next opening.
	 */
	async accept() {
		const prompt = this.#prompt;
		if (!prompt) return;

		this.#prompt = null;

		try {
			await prompt.prompt();
			const { outcome } = await prompt.userChoice;
			if (outcome === 'dismissed') this.refuse();
			else this.dismissed = true;
		} catch {
			// Prompt already consumed by another tab: nothing to report, the browser menu stays open to whoever
			// wants it.
			this.dismissed = true;
		}
	}

	/** "Later", and we remember it for six months. */
	refuse() {
		this.dismissed = true;
		this.detailsOpen = false;
		this.#refusedAt = Date.now();
		this.#save();
	}

	showDetails() {
		this.detailsOpen = true;
	}

	hideDetails() {
		this.detailsOpen = false;
	}
}

export const install = new InstallStore();
