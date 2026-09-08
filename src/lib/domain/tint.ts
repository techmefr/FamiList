/**
 * Rendre lisible du texte blanc posé sur une teinte choisie par quelqu'un d'autre.
 *
 * Les teintes de membres et de magasins sont des données : elles arrivent de la base, personne ne
 * les a validées contre un ratio de contraste. Celle qui était posée par défaut, l'ancienne
 * terracotta #C8532A, donnait 4,44:1 sous du blanc — juste sous les 4,5:1 exigés. Et noircir le
 * texte n'aurait pas sauvé ce cas-là : sur cette teinte, l'encre sombre ne fait que 3,97:1. Aucune
 * couleur de texte ne passe sur une teinte de milieu de gamme, il faut donc bouger le fond.
 *
 * On assombrit par paliers jusqu'à ce que le blanc passe. La teinte reste reconnaissable — c'est
 * la même couleur, plus foncée — et la convergence est garantie puisque le noir donne 21:1.
 */
/**
 * Palette des teintes attribuées aux magasins, aux cartes et aux listes.
 *
 * Ce sont des couleurs de repérage, pas la couleur d'accent : deux magasins doivent se distinguer
 * l'un de l'autre, les aligner sur l'accent les rendrait tous identiques. On les parcourt en
 * boucle à la création pour que les premières créations se distinguent d'emblée.
 *
 * Elles passent toutes par `tintForWhiteText` à l'affichage, qui les assombrit au besoin : la
 * liste n'a donc pas à être vérifiée au contraste, seule sa lisibilité de teinte compte.
 */
export const TINTS = ['#5A4A2F', '#8B3A62', '#4A6B3A', '#C67A3E', '#2563EB', '#1F5C3A'];

/** Teinte reprise quand la base n'en porte pas, pour un magasin, une carte ou une liste. */
export const DEFAULT_TINT = TINTS[0];

/**
 * Teinte de repli d'un membre : la terracotta par défaut, recopiée de --primary dans app.css. Un
 * membre sans couleur est un membre qui n'a pas encore choisi, autant lui donner celle de l'app.
 */
export const DEFAULT_MEMBER_TINT = '#A94008';

/** Bas du dégradé d'une carte de fidélité, commun à toutes les teintes. */
export const CARD_GRADIENT_END = '#2E2518';

const CIBLE = 4.5;
const PALIER = 0.04;

const canal = (v: number) => {
	const s = v / 255;
	return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

/** Luminance relative WCAG. */
export const luminance = ({ r, g, b }: Rgb) =>
	0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);

/** Contraste WCAG entre du blanc pur et une couleur. */
export const contrastWithWhite = (couleur: Rgb) => 1.05 / (luminance(couleur) + 0.05);

export interface Rgb {
	r: number;
	g: number;
	b: number;
}

/**
 * Accepte `#rgb` et `#rrggbb`. Rend null sur tout le reste — un `oklch(...)` ou un nom CSS stocké
 * en base ne doit pas être deviné, l'appelant le laissera passer tel quel.
 */
export function parseHex(value: string | null | undefined): Rgb | null {
	const brut = (value ?? '').trim();
	const court = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(brut);
	if (court) {
		const [, r, g, b] = court;
		return { r: parseInt(r + r, 16), g: parseInt(g + g, 16), b: parseInt(b + b, 16) };
	}
	const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(brut);
	if (!long) return null;
	return { r: parseInt(long[1], 16), g: parseInt(long[2], 16), b: parseInt(long[3], 16) };
}

const octet = (v: number) =>
	Math.round(Math.max(0, Math.min(255, v)))
		.toString(16)
		.padStart(2, '0');

const toHex = ({ r, g, b }: Rgb) => '#' + octet(r) + octet(g) + octet(b);

/**
 * Teinte assez sombre pour porter du texte blanc à 4,5:1. Une teinte déjà assez sombre ressort
 * inchangée, et une valeur qu'on ne sait pas lire aussi : mieux vaut afficher la couleur demandée
 * que d'inventer.
 */
export function tintForWhiteText(value: string | null | undefined): string {
	const rgb = parseHex(value);
	if (!rgb) return (value ?? '').trim();

	let couleur = rgb;
	// 40 paliers de 4 % suffisent largement à atteindre le noir, la boucle est bornée par sécurité.
	for (let i = 0; i < 40 && contrastWithWhite(couleur) < CIBLE; i++) {
		couleur = {
			r: couleur.r * (1 - PALIER),
			g: couleur.g * (1 - PALIER),
			b: couleur.b * (1 - PALIER)
		};
	}

	return toHex(couleur);
}
