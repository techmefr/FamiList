/** The one provider `place_credentials` accepts, and where to get a key for it. */
export const PLACE_PROVIDERS = [
	{
		id: 'google_places',
		name: 'Google Places',
		keyUrl: 'https://developers.google.com/maps/documentation/places/web-service/get-api-key'
	}
] as const;

export type PlaceProviderId = (typeof PLACE_PROVIDERS)[number]['id'];

export function isPlaceProvider(id: string): id is PlaceProviderId {
	return PLACE_PROVIDERS.some((provider) => provider.id === id);
}
