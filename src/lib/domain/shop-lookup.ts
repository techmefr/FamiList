/**
 * Finding a shop by name instead of typing brand, name and address by hand.
 *
 * This is the one place in the app that breaks the rule `ShopForm` used to state outright: what is typed
 * here does leave the phone, to OpenStreetMap's Nominatim, a free public geocoder with no account and no
 * key. It fires only when someone presses the search button, never as they type, and only the query text is
 * sent — never the household's data. Nominatim's usage policy caps this at one request per second and asks
 * for an identifying User-Agent; both are honoured below.
 *
 * Google Places answers with cleaner brand names and a real place database, but it is a paid, key-gated API:
 * whoever wants it brings their own key on `/profile/images`, the same way as for the AI providers and the
 * image banks (`place_credentials`, mirroring `image_bank_credentials`). With no key, Nominatim is the
 * default and the only thing sent anywhere is the search text.
 */

export interface ShopLookupResult {
	name: string;
	address: string;
	lat: number;
	lng: number;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** Identifies the app to Nominatim, as its usage policy asks. */
const USER_AGENT = 'FamiList (https://familiste.fr)';

function text(row: Record<string, unknown>, key: string): string | undefined {
	const value = row[key];
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * A short label from OSM's address parts: the shop's own name if it has one, otherwise its street and town —
 * enough to tell two results apart without repeating the full address underneath.
 */
function labelOf(row: Record<string, unknown>): string {
	const address = (row.address ?? {}) as Record<string, unknown>;
	const named = text(row, 'name') ?? text(address, 'shop') ?? text(address, 'amenity');
	if (named) return named;

	const street = text(address, 'road');
	const town = text(address, 'town') ?? text(address, 'city') ?? text(address, 'village');
	return [street, town].filter(Boolean).join(', ');
}

function addressOf(row: Record<string, unknown>): string {
	const full = text(row, 'display_name');
	return full ?? '';
}

async function searchNominatim(query: string): Promise<ShopLookupResult[]> {
	const url = `${NOMINATIM_URL}?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(query)}`;

	const response = await fetch(url, {
		headers: { 'Accept-Language': 'fr', 'User-Agent': USER_AGENT }
	});

	if (!response.ok) throw new Error(`nominatim ${response.status}`);

	const rows: unknown = await response.json().catch(() => null);
	if (!Array.isArray(rows)) throw new Error('nominatim: unexpected payload');

	return rows
		.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
		.map((row) => ({
			name: labelOf(row),
			address: addressOf(row),
			lat: Number(row.lat),
			lng: Number(row.lon)
		}))
		.filter((result) => result.name && Number.isFinite(result.lat) && Number.isFinite(result.lng));
}

const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_FIELD_MASK = 'places.displayName,places.formattedAddress,places.location';

interface GooglePlace {
	displayName?: { text?: string };
	formattedAddress?: string;
	location?: { latitude?: number; longitude?: number };
}

/**
 * A Google Places (New) text search, for whoever brought their own key on `/profile/images` — see
 * `place-credentials.svelte.ts`. Cleaner brand names and a real place database, at the cost of a paid,
 * key-gated API nobody is asked to sign up for by default.
 */
async function searchGooglePlaces(query: string, apiKey: string): Promise<ShopLookupResult[]> {
	const response = await fetch(GOOGLE_PLACES_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Goog-Api-Key': apiKey,
			'X-Goog-FieldMask': GOOGLE_FIELD_MASK
		},
		body: JSON.stringify({ textQuery: query, languageCode: 'fr' })
	});

	if (!response.ok) throw new Error(`google places ${response.status}`);

	const payload: unknown = await response.json().catch(() => null);
	const places = (payload as { places?: GooglePlace[] } | null)?.places;
	if (!Array.isArray(places)) return [];

	return places
		.map((place) => ({
			name: place.displayName?.text?.trim() ?? '',
			address: place.formattedAddress?.trim() ?? '',
			lat: Number(place.location?.latitude),
			lng: Number(place.location?.longitude)
		}))
		.filter((result) => result.name && Number.isFinite(result.lat) && Number.isFinite(result.lng));
}

export async function searchShops(query: string, googlePlacesKey?: string): Promise<ShopLookupResult[]> {
	const trimmed = query.trim();
	if (!trimmed) return [];

	return googlePlacesKey ? searchGooglePlaces(trimmed, googlePlacesKey) : searchNominatim(trimmed);
}
