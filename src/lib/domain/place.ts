import { slugify } from './slug';

/**
 * Ce qui identifie un magasin : une enseigne, un nom, une adresse.
 *
 * Les trois ne servent pas la même chose. L'enseigne dit à quelle chaîne on a affaire — c'est elle
 * qui portera la carte de fidélité, valable dans n'importe quel Carrefour. Le nom est celui qu'on
 * lit sur la devanture, et il suffit à lui seul pour un commerce indépendant. L'adresse distingue
 * deux magasins de la même enseigne, et c'est d'elle qu'on tire la commune.
 *
 * L'enseigne est facultative, et c'est le cas le plus intéressant : un salon de coiffure, une
 * boucherie de quartier n'en ont pas. Tout ce qui suit doit donc marcher sans elle.
 */
export interface Place {
	brand?: string;
	name: string;
	address?: string;
}

/**
 * La commune d'une adresse française, sans appeler personne.
 *
 * Le repère est le code postal : cinq chiffres, puis la commune jusqu'à la fin ou jusqu'à la
 * virgule suivante. C'est la seule règle stable d'une adresse écrite à la main — l'ordre des
 * lignes, les abréviations et la ponctuation, eux, varient d'une personne à l'autre.
 *
 * Sans code postal, on prend le dernier morceau séparé par une virgule : « 12 rue des Lilas,
 * Meximieux » se lit encore. Et s'il n'y a ni l'un ni l'autre, on rend une chaîne vide plutôt que
 * de deviner — un mauvais trigramme est pire que pas de trigramme du tout.
 *
 * Aucun géocodage : l'adresse ne sort pas de l'appareil, il n'y a ni clé d'API ni service tiers à
 * tenir en vie, et l'application continue de fonctionner sans réseau.
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

	// Un seul morceau, c'est la rue ou le nom du lieu, pas une commune : on ne l'invente pas.
	if (morceaux.length < 2) return '';

	const dernier = morceaux.at(-1) ?? '';
	// Un pays en fin d'adresse n'est pas une commune. La liste reste courte volontairement : elle
	// couvre ce qu'on écrit vraiment, pas le monde entier.
	const PAYS = new Set(['france', 'belgique', 'suisse', 'luxembourg', 'canada', 'madagascar']);

	if (PAYS.has(slugify(dernier))) return morceaux.at(-2) ?? '';
	return dernier;
}

/**
 * Ce qu'on donne à lire au générateur de trigramme.
 *
 * Une chaîne : l'enseigne et la commune, parce que c'est ce qui distingue deux magasins entre eux
 * — « Carrefour Meximieux » donne CMX, « Carrefour Miribel » donne CMI. Le nom du magasin, lui,
 * répète souvent l'enseigne et n'apporte rien.
 *
 * Un indépendant : son nom, tout simplement, éventuellement suivi de la commune s'il en a une —
 * « Salon Émilie » donne SEM, et deux salons dans deux villes se départagent d'eux-mêmes.
 *
 * Le résultat n'est jamais vide tant qu'il y a un nom : c'est le minimum dont le générateur a
 * besoin pour rendre trois caractères.
 */
export function trigramSource({ brand, name, address }: Place): string {
	const enseigne = (brand ?? '').trim();
	const commune = communeFromAddress(address);
	const tete = enseigne || name.trim();

	return [tete, commune].filter(Boolean).join(' ').trim();
}
