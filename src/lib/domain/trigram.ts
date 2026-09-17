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
const LENGTH = 3;

export function trigram(name: string, taken: Iterable<string> = []): string {
	const takenShorts = new Set(
		[...taken].map((short) => short.trim().toUpperCase()).filter((short) => short.length > 0)
	);

	let first = '';

	for (const candidate of candidates(name)) {
		first ||= candidate;
		if (!takenShorts.has(candidate)) return candidate;
	}

	// Everything is taken, down to the numbered suffixes. Returning an empty badge would be worse than
	// returning a duplicate: at least the duplicate says which brand it is.
	return first;
}

/** The possible codes for this name, from the most telling to the most remote. */
function* candidates(name: string): Generator<string> {
	const words = slugify(name)
		.split('-')
		.filter(Boolean)
		.map((word) => word.toUpperCase());

	if (words.length === 0) {
		// A name with no letter or digit — a lone emoji, "###". slugify empties it completely; rather than a
		// blank badge, we keep what was typed. The splitting goes through code points, otherwise an emoji would
		// be cut into two halves of a surrogate pair.
		const raw = [...name.trim().replaceAll(/\s+/g, '')].slice(0, LENGTH).join('').toUpperCase();
		if (raw) yield* withSuffixes(raw);
		return;
	}

	const letters = words.join('');

	// A name shorter than the code is not shortened: "U", "Bio".
	if (letters.length <= LENGTH) {
		yield* withSuffixes(letters);
		return;
	}

	const last = words.at(-1)!;
	let base: string;
	let preferred: (string | undefined)[];

	if (words.length === 1) {
		base = letters.slice(0, 2);
		preferred = [letters[2]];
	} else if (words.length === 2) {
		base = words[0][0] + words[1][0];
		// A one-letter word — the "U" of Super U — has no last letter distinct from its initial. The filter
		// below takes care of it, and we then complete from the whole name.
		preferred = [last.at(-1)];
	} else {
		base = words[0][0] + words[1][0];
		preferred = [words[2][0], last.at(-1)];
	}

	// The sequence of candidates comes first from the last word — it is the town that tells two shops of the
	// same brand apart, not the brand — then from the whole name. We skip the first letter, already taken as
	// the initial, and any letter that would double the one before: "SUU" does not read.
	const suite = [...preferred, ...last.slice(1), ...letters.slice(1)].filter(
		(letter): letter is string => Boolean(letter) && letter !== base.at(-1)
	);

	for (const letter of new Set(suite)) yield base + letter;

	yield* suffixes(base);
}

/** Last resort: the same start, numbered. */
function* suffixes(base: string): Generator<string> {
	for (const digit of '23456789') yield base + digit;
}

function* withSuffixes(short: string): Generator<string> {
	yield short;
	yield* suffixes(short.slice(0, 2));
}
