/**
 * Which loyalty card to bring out on arriving at a shop.
 *
 * Everything is pure and platform-free: the geometry, the choice of shop, the rule that avoids notifying
 * again. The native layer only reads a position and shows what is decided here.
 */

export interface NearbyShop {
	shopId: string;
	name: string;
	brand: string;
	lat?: number;
	lng?: number;
}

export interface NearbyCard {
	cardId: string;
	name: string;
	/** Attachment to a specific shop, empty when the card is valid for a whole brand. */
	shopId: string;
	brand: string;
}

export interface NearbyPosition {
	lat: number;
	lng: number;
}

export interface NearbyAlert {
	shopId: string;
	shopName: string;
	cardId: string;
	cardName: string;
	/** Integer id required by local notifications, derived from the shop id. */
	id: number;
	meters: number;
}

/**
 * The trigger radius, deliberately wide.
 *
 * Three hundred metres is the car park and the street opposite: you are still outside, the card is ready
 * before the till. Tighter, it would take a position accurate to the metre, so the GPS at full power all
 * the time — the battery would not survive it, and a position fifty metres off, which is common in town,
 * would simply miss the shop.
 */
export const NEARBY_RADIUS_M = 300;

/**
 * The minimum delay between two checks.
 *
 * The device can return a position every second; we have no need of that. On foot as in a car, three
 * minutes do not cross a three-hundred-metre radius without a single measurement falling inside it, and
 * that is so many computations and wake-ups saved.
 */
export const NEARBY_CHECK_MS = 3 * 60 * 1000;

const EARTH_RADIUS_M = 6_371_000;

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * The distance between two points, as the crow flies.
 *
 * Haversine formula: the Earth is treated as a sphere, which leaves an error of a few metres over the
 * distances we care about. Well under the trigger radius, and with no dependency at all.
 */
export function distanceMeters(a: NearbyPosition, b: NearbyPosition): number {
	const dLat = radians(b.lat - a.lat);
	const dLng = radians(b.lng - a.lng);
	const arc =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;

	return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(arc)));
}

const normalize = (text: string) => text.trim().toLowerCase();

/**
 * The card to bring out for this shop, if there is one.
 *
 * A direct attachment wins over the brand: a card set on the Carrefour in Meximieux is more precise than
 * a Carrefour card valid everywhere. Failing that, the brand is enough — that is the common case, and it
 * is exactly what the migration that added `brand` had in mind.
 *
 * Nothing is returned when no card matches: there is then nothing to offer, and an empty notification
 * would be worse than silence.
 */
export function cardForShop(shop: NearbyShop, cards: NearbyCard[]): NearbyCard | null {
	const byShop = cards.find((card) => card.shopId === shop.shopId);
	if (byShop) return byShop;

	const brand = normalize(shop.brand ?? '');
	if (!brand) return null;

	return cards.find((card) => normalize(card.brand) === brand) ?? null;
}

/** The day as lived, in the device timezone: it is the unit of the anti-repeat rule. */
export function nearbyDay(now: Date): string {
	const month = `${now.getMonth() + 1}`.padStart(2, '0');
	const day = `${now.getDate()}`.padStart(2, '0');

	return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * A stable integer for a shop, in a reserved range.
 *
 * Local notifications are identified by an integer. The offset avoids landing on a list reminder id,
 * computed the same way but from another UUID: two notifications sharing a number replace each other in
 * the tray.
 */
export const NEARBY_ID_OFFSET = 1_000_000_000;

export function nearbyId(shopId: string): number {
	let hash = 0;
	for (const character of shopId) hash = (hash * 31 + character.charCodeAt(0)) | 0;

	return NEARBY_ID_OFFSET + (Math.abs(hash) % 1_000_000_000);
}

/**
 * The shop to announce, now, or nothing.
 *
 * One at a time, and it is the nearest: in a retail park three brands overlap, and three notifications at
 * once are three times easier to swipe away unread. The one you are really in front of is the one you are
 * nearest to.
 *
 * `notified` carries the last announced day per shop. Passing the same shop again on the same day says
 * nothing more: you rarely go twice, and forgetting the card only happens on the first visit. The next
 * day, the question arises again on its own.
 *
 * A shop with no position is ignored: "not taken yet" is not a position.
 */
export function nearbyAlert(
	position: NearbyPosition,
	shops: NearbyShop[],
	cards: NearbyCard[],
	notified: Record<string, string>,
	now: Date,
	radius: number = NEARBY_RADIUS_M
): NearbyAlert | null {
	const today = nearbyDay(now);
	let best: NearbyAlert | null = null;

	for (const shop of shops) {
		if (typeof shop.lat !== 'number' || typeof shop.lng !== 'number') continue;
		if (notified[shop.shopId] === today) continue;

		const meters = distanceMeters(position, { lat: shop.lat, lng: shop.lng });
		if (meters > radius) continue;

		const card = cardForShop(shop, cards);
		if (!card) continue;

		if (best && best.meters <= meters) continue;

		best = {
			shopId: shop.shopId,
			shopName: shop.name,
			cardId: card.cardId,
			cardName: card.name,
			id: nearbyId(shop.shopId),
			meters
		};
	}

	return best;
}

/**
 * The log of announcements, cut down to the strict minimum.
 *
 * Only the current day is kept: the rule looks no further, and keeping the history of a shop deleted six
 * months ago serves nobody.
 */
export function rememberNotified(
	notified: Record<string, string>,
	shopId: string,
	now: Date
): Record<string, string> {
	const today = nearbyDay(now);
	const kept: Record<string, string> = {};

	for (const [id, day] of Object.entries(notified)) {
		if (day === today) kept[id] = day;
	}

	kept[shopId] = today;
	return kept;
}
