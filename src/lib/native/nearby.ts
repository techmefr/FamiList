import { Capacitor } from '@capacitor/core';
import {
	nearbyAlert,
	NEARBY_CHECK_MS,
	rememberNotified,
	type NearbyAlert,
	type NearbyCard,
	type NearbyShop
} from '$domain/nearby';

/**
 * Offering the loyalty card on arriving at a shop.
 *
 * It is native and nothing else. A browser does not watch a position: the tab is suspended as soon as you
 * leave it, and closed it runs nothing at all. On the web we therefore start no watch, and the interface
 * says so instead of suggesting a notification that will never come.
 *
 * Even natively, the promise is bounded and it is better written down: the watch lives with the
 * application. While it is open or recently backgrounded, positions arrive; once the application is
 * killed by the system, nothing runs any more — keeping that promise would need a foreground service with
 * its permanent notification, which costs more in battery and attention than the feature brings.
 */
export type NearbyPermission = 'granted' | 'denied' | 'unsupported';

export interface NearbyContext {
	shops: NearbyShop[];
	cards: NearbyCard[];
	texts: (alert: NearbyAlert) => { title: string; body: string };
	onOpen: (cardId: string) => void;
}

const JOURNAL_KEY = 'familiste:nearby';

export function nearbySupported(): boolean {
	return Capacitor.isNativePlatform();
}

/**
 * The log of shops already announced, kept on the device.
 *
 * Deliberately local and not synced: it is this phone that passed this shop. Somebody else in the
 * household going there the same day is entitled to their own notification.
 */
function lireJournal(): Record<string, string> {
	try {
		const brut = JSON.parse(localStorage.getItem(JOURNAL_KEY) ?? '{}');
		return typeof brut === 'object' && brut !== null ? (brut as Record<string, string>) : {};
	} catch {
		return {};
	}
}

function ecrireJournal(journal: Record<string, string>) {
	try {
		localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal));
	} catch {
		// Storage full or refused: at worst one notification too many, nothing broken.
	}
}

/**
 * Asking for both permissions, and only on a gesture from the person.
 *
 * Position and notifications are asked for together because one without the other is of no use here. A
 * refusal is not an error: the setting stays refusable, and the interface announces what is missing
 * rather than staying silent.
 */
export async function requestNearbyPermission(): Promise<NearbyPermission> {
	if (!nearbySupported()) return 'unsupported';

	try {
		const { Geolocation } = await import('@capacitor/geolocation');
		const { LocalNotifications } = await import('@capacitor/local-notifications');

		const position = await Geolocation.requestPermissions({ permissions: ['location'] });
		if (position.location !== 'granted') return 'denied';

		const notifications = await LocalNotifications.checkPermissions();
		if (notifications.display === 'granted') return 'granted';

		const demandee = await LocalNotifications.requestPermissions();
		return demandee.display === 'granted' ? 'granted' : 'denied';
	} catch {
		return 'unsupported';
	}
}

let contexte: NearbyContext | null = null;
let veille: string | null = null;
let dernierControle = 0;
let ecoute = false;

async function annoncer(latitude: number, longitude: number) {
	if (!contexte) return;

	const maintenant = new Date();
	// The position can arrive every second; we only look at one now and then.
	if (maintenant.getTime() - dernierControle < NEARBY_CHECK_MS) return;
	dernierControle = maintenant.getTime();

	const alerte = nearbyAlert(
		{ lat: latitude, lng: longitude },
		contexte.shops,
		contexte.cards,
		lireJournal(),
		maintenant
	);
	if (!alerte) return;

	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');

		const permission = await LocalNotifications.checkPermissions();
		if (permission.display !== 'granted') return;

		const { title, body } = contexte.texts(alerte);

		// The log is written before sending: if the display fails, better a missed notification than a loop
		// retrying on every position.
		ecrireJournal(rememberNotified(lireJournal(), alerte.shopId, maintenant));

		await LocalNotifications.schedule({
			notifications: [
				{
					id: alerte.id,
					title,
					body,
					// No scheduling: we are in front of the shop now, not later.
					extra: { cardId: alerte.cardId }
				}
			]
		});
	} catch {
		// Plugin absent or channel refused: the cards stay reachable by hand.
	}
}

/**
 * The tap of the watch, replayed on every change.
 *
 * A single watch runs at a time, and the context is replaced live: a shop created, a card attached or a
 * position taken are taken into account without restarting the GPS.
 *
 * Low accuracy is accepted: at a three-hundred-metre radius, the network and wifi access points are
 * enough, and that is what lets the watch run without draining the battery.
 */
export async function applyNearbyWatch(enabled: boolean, next: NearbyContext): Promise<void> {
	contexte = next;

	if (!nearbySupported()) return;

	try {
		const { Geolocation } = await import('@capacitor/geolocation');

		if (!enabled) {
			if (veille) await Geolocation.clearWatch({ id: veille });
			veille = null;
			return;
		}

		if (!ecoute) {
			const { LocalNotifications } = await import('@capacitor/local-notifications');

			// Tapping the notification opens the card: that is the whole point of offering it.
			await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
				const cardId = action.notification.extra?.cardId;
				if (typeof cardId === 'string') contexte?.onOpen(cardId);
			});
			ecoute = true;
		}

		if (veille) return;

		const permission = await Geolocation.checkPermissions();
		if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') return;

		veille = await Geolocation.watchPosition(
			{ enableHighAccuracy: false, timeout: 30_000, maximumAge: NEARBY_CHECK_MS },
			(position) => {
				if (!position) return;
				void annoncer(position.coords.latitude, position.coords.longitude);
			}
		);
	} catch {
		// Plugin absent or position unavailable: nothing fires, nothing breaks.
	}
}
