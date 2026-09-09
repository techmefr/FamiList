/**
 * Le portrait d'une personne dans le foyer : une photo si elle en a posé une, ses initiales sinon.
 *
 * Les initiales ne sont pas un pis-aller en attendant la photo. Beaucoup de gens n'en mettront
 * jamais, et une pastille de couleur avec deux lettres se distingue d'un coup d'œil dans une pile
 * d'avatars — mieux qu'une silhouette générique répétée quatre fois.
 */

/** Le côté du carré enregistré, en pixels. */
export const AVATAR_SIZE = 128;

/** Au-delà, on refuse le fichier avant même de le lire : ce n'est pas une photo de profil. */
export const AVATAR_MAX_BYTES = 12 * 1024 * 1024;

/**
 * Une ou deux lettres tirées du nom.
 *
 * Deux mots donnent deux initiales, un seul donne sa première lettre. On ignore les particules
 * (« de », « van », « el ») : « Jean de La Fontaine » se lit JL, pas JD. Les accents restent —
 * « Élise » donne « É », qui est la bonne lettre, et la pastille a la place de l'afficher.
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

function premiere(mot: string): string {
	return [...mot][0].toLocaleUpperCase();
}

/**
 * Le carré à découper dans une image pour en faire un portrait, sans la déformer.
 *
 * On prend le plus grand carré possible et on le centre : redimensionner une photo rectangulaire
 * à un carré l'écrase, et un visage écrasé se remarque immédiatement. Le centre est le bon défaut
 * — c'est là que les gens se placent quand ils se photographient.
 */
export function coverSquare(width: number, height: number) {
	const cote = Math.min(width, height);

	return {
		sx: Math.round((width - cote) / 2),
		sy: Math.round((height - cote) / 2),
		taille: cote
	};
}
