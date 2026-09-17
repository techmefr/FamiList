/**
 * A person's portrait in the household: a photo if they set one, their initials otherwise.
 *
 * The initials are not a stopgap while waiting for the photo. Many people will never set one, and a
 * coloured badge with two letters stands out at a glance in a stack of avatars — better than a generic
 * silhouette repeated four times.
 */

/** The side of the saved square, in pixels. */
export const AVATAR_SIZE = 128;

/** Beyond this, we refuse the file before even reading it: that is not a profile photo. */
export const AVATAR_MAX_BYTES = 12 * 1024 * 1024;

/**
 * One or two letters drawn from the name.
 *
 * Two words give two initials, one gives its first letter. We ignore particles ("de", "van", "el"): "Jean
 * de La Fontaine" reads JL, not JD. Accents stay — "Élise" gives "É", which is the right letter, and the
 * badge has room to show it.
 */
const PARTICULES = new Set(['de', 'du', 'des', 'da', 'di', 'del', 'la', 'le', 'van', 'von', 'el']);

export function initialsOf(name: string): string {
	const mots = name
		.trim()
		.split(/[\s'’-]+/)
		.filter((mot) => mot.length > 0 && !PARTICULES.has(mot.toLowerCase()));

	if (mots.length === 0) return '—';
	if (mots.length === 1) return premiere(mots[0]);

	return premiere(mots[0]) + premiere(mots[mots.length - 1]);
}

/**
 * A member's initials, drawn from what we know of them.
 *
 * First and last name take priority when they are filled in: the display name is free text, it can be
 * "Granny" or "Lulu", and splitting a one-word nickname would give one letter where the full identity
 * gives two. As long as they are empty — which is the case of every account created before they existed —
 * we fall back on the display name, which is often "First Last" anyway.
 */
export function initialsFor(firstName: string, lastName: string, displayName: string): string {
	const complet = `${firstName.trim()} ${lastName.trim()}`.trim();
	return complet ? initialsOf(complet) : initialsOf(displayName);
}

function premiere(mot: string): string {
	return [...mot][0].toLocaleUpperCase();
}

/**
 * The square to crop out of an image to make a portrait, without distorting it.
 *
 * We take the largest possible square and centre it: resizing a rectangular photo to a square squashes it,
 * and a squashed face is noticed immediately. The centre is the right default — that is where people place
 * themselves when they photograph themselves.
 */
export function coverSquare(width: number, height: number) {
	const cote = Math.min(width, height);

	return {
		sx: Math.round((width - cote) / 2),
		sy: Math.round((height - cote) / 2),
		taille: cote
	};
}
