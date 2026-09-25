/**
 * Finding a shop by name instead of typing brand, name and address by hand.
 *
 * This is the one place in the app that breaks the rule `ShopForm` used to state outright: what is typed
 * here does leave the phone, to OpenStreetMap's Nominatim, a free public geocoder with no account and no
 * key. It fires only when someone presses the search button, never as they type, and only the query text is
 * sent — never the household's data. Nominatim's usage policy caps this at one request per second and asks
 * for an identifying User-Agent; both are honoured below.
 *
 * Google Places would answer with cleaner brand names and opening hours, but it is a paid, key-gated API: a
 * household wanting it would bring its own key the same way it already does for the AI providers and the
 * image banks (`image_bank_credentials`). Nobody has asked for it yet, so it is not wired in.
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

export async function searchShops(query: string): Promise<ShopLookupResult[]> {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const url = `${NOMINATIM_URL}?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(trimmed)}`;

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
