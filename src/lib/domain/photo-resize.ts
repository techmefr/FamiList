/** Wide enough for a full-width card on a tablet, small enough to upload quickly on a weak connection. */
export const RECIPE_PHOTO_MAX_SIDE = 1600;

export const RECIPE_PHOTO_QUALITY = 0.85;

/** A photo straight off a phone camera can weigh this much; anything bigger is refused before decoding. */
export const RECIPE_PHOTO_MAX_BYTES = 25 * 1024 * 1024;

export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
	const longest = Math.max(width, height);
	if (longest <= maxSide || longest === 0) return { width, height };

	const ratio = maxSide / longest;
	return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}
