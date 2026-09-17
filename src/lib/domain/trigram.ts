import { slugify } from './slug';

/**
 * A shop's initials, as they show in the coloured badge.
 *
 * A shop carries the name of its brand and that of its town — Carrefour Meximieux, Super U Montluel. It is
 * the town that distinguishes, not the brand: three letters taken from the start would give CAR to every
 * Carrefour in the county. So the rule starts from the words:
 *
 *   one initial per word, completed by the last letter when there are not three words.
 *
 *   Carrefour Meximieux    CMX     two initials, then the last letter of the town
 *   Super U Montluel       SUM     three words, three initials
 *   Carrefour              CAR     a single word, its first three letters
 *
 * Two shops can still land on the same code. `taken` then receives those already in use, and we move on a
 * letter: Carrefour Meximieux gives CMX, the next CME, then CMI. The candidates are drawn from the name,
 * in its order, so the code stays recognisable even when it is no longer the first choice.
 */
const LONGUEUR = 3;

export function trigram(name: string, taken: Iterable<string> = []): string {
	const pris = new Set(
		[...taken].map((court) => court.trim().toUpperCase()).filter((court) => court.length > 0)
	);

	let premier = '';

	for (const candidat of candidats(name)) {
		premier ||= candidat;
		if (!pris.has(candidat)) return candidat;
	}

	// Everything is taken, down to the numbered suffixes. Returning an empty badge would be worse than
	// returning a duplicate: at least the duplicate says which brand it is.
	return premier;
}

/** The possible codes for this name, from the most telling to the most remote. */
function* candidats(name: string): Generator<string> {
	const mots = slugify(name)
		.split('-')
		.filter(Boolean)
		.map((mot) => mot.toUpperCase());

	if (mots.length === 0) {
		// A name with no letter or digit — a lone emoji, "###". slugify empties it completely; rather than a
		// blank badge, we keep what was typed. The splitting goes through code points, otherwise an emoji would
		// be cut into two halves of a surrogate pair.
		const brut = [...name.trim().replaceAll(/\s+/g, '')].slice(0, LONGUEUR).join('').toUpperCase();
		if (brut) yield* avecSuffixes(brut);
		return;
	}

	const lettres = mots.join('');

	// A name shorter than the code is not shortened: "U", "Bio".
	if (lettres.length <= LONGUEUR) {
		yield* avecSuffixes(lettres);
		return;
	}

	const dernier = mots.at(-1)!;
	let base: string;
	let preferees: (string | undefined)[];

	if (mots.length === 1) {
		base = lettres.slice(0, 2);
		preferees = [lettres[2]];
	} else if (mots.length === 2) {
		base = mots[0][0] + mots[1][0];
		// A one-letter word — the "U" of Super U — has no last letter distinct from its initial. The filter
		// below takes care of it, and we then complete from the whole name.
		preferees = [dernier.at(-1)];
	} else {
		base = mots[0][0] + mots[1][0];
		preferees = [mots[2][0], dernier.at(-1)];
	}

	// The sequence of candidates comes first from the last word — it is the town that tells two shops of the
	// same brand apart, not the brand — then from the whole name. We skip the first letter, already taken as
	// the initial, and any letter that would double the one before: "SUU" does not read.
	const suite = [...preferees, ...dernier.slice(1), ...lettres.slice(1)].filter(
		(lettre): lettre is string => Boolean(lettre) && lettre !== base.at(-1)
	);

	for (const lettre of new Set(suite)) yield base + lettre;

	yield* suffixes(base);
}

/** Last resort: the same start, numbered. */
function* suffixes(base: string): Generator<string> {
	for (const chiffre of '23456789') yield base + chiffre;
}

function* avecSuffixes(court: string): Generator<string> {
	yield court;
	yield* suffixes(court.slice(0, 2));
}
