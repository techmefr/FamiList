import { slugify } from './slug';

/**
 * What identifies a shop: a brand, a name, an address.
 *
 * The three do not serve the same purpose. The brand says which chain you are dealing with — it is what
 * will carry the loyalty card, valid in any Carrefour. The name is the one you read on the front, and it
 * is enough on its own for an independent shop. The address tells two shops of the same brand apart, and
 * it is what the town is taken from.
 *
 * The brand is optional, and that is the most interesting case: a hairdresser, a local butcher have none.
 * Everything that follows must therefore work without it.
 */
export interface Place {
	brand?: string;
	name: string;
	address?: string;
}

/**
 * The town of a French address, without calling anybody.
 *
 * The landmark is the postcode: five digits, then the town up to the end or up to the next comma. It is
 * the only stable rule of a hand-written address — the order of the lines, the abbreviations and the
 * punctuation vary from one person to another.
 *
 * With no postcode, we take the last comma-separated part: "12 rue des Lilas, Meximieux" still reads. And
 * if there is neither, we return an empty string rather than guess — a wrong three-letter code is worse
 * than no code at all.
 *
 * No geocoding: the address does not leave the device, there is no API key and no third-party service to
 * keep alive, and the application keeps working without network.
 */
export function communeFromAddress(address: string | null | undefined): string {
	const texte = (address ?? '').trim();
	if (!texte) return '';

	const parCodePostal = texte.match(/\b\d{5}\b\s*([^,;\n]+)/);
	if (parCodePostal?.[1]?.trim()) return parCodePostal[1].trim();

	const morceaux = texte
		.split(/[,;\n]/)
		.map((morceau) => morceau.trim())
		.filter(Boolean);

	// A single part is the street or the place name, not a town: we do not invent it.
	if (morceaux.length < 2) return '';

	const dernier = morceaux.at(-1) ?? '';
	// A country at the end of an address is not a town. The list stays short deliberately: it covers what
	// people really write, not the whole world.
	const PAYS = new Set(['france', 'belgique', 'suisse', 'luxembourg', 'canada', 'madagascar']);

	if (PAYS.has(slugify(dernier))) return morceaux.at(-2) ?? '';
	return dernier;
}

/**
 * What we give the three-letter code generator to read.
 *
 * A chain: the brand and the town, because that is what tells two shops apart — "Carrefour Meximieux"
 * gives CMX, "Carrefour Miribel" gives CMI. The shop's name often repeats the brand and adds nothing.
 *
 * An independent: its name, simply, possibly followed by the town if it has one — "Salon Émilie" gives
 * SEM, and two salons in two towns separate themselves.
 *
 * The result is never empty as long as there is a name: it is the minimum the generator needs to return
 * three characters.
 */
export function trigramSource({ brand, name, address }: Place): string {
	const enseigne = (brand ?? '').trim();
	const commune = communeFromAddress(address);
	const tete = enseigne || name.trim();

	return [tete, commune].filter(Boolean).join(' ').trim();
}
