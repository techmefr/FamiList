import { slugify } from './slug';

/**
 * Les initiales d'un magasin, telles qu'elles s'affichent dans la pastille de couleur.
 *
 * Un magasin porte le nom de son enseigne et celui de sa commune — Carrefour Meximieux, Super U
 * Montluel. C'est la commune qui distingue, pas l'enseigne : trois lettres prises au début
 * donneraient CAR à tous les Carrefour du département. La règle part donc des mots :
 *
 *   une initiale par mot, complétée par la dernière lettre quand il n'y a pas trois mots.
 *
 *   Carrefour Meximieux    CMX     deux initiales, puis la dernière lettre de la commune
 *   Super U Montluel       SUM     trois mots, trois initiales
 *   Carrefour              CAR     un seul mot, ses trois premières lettres
 *
 * Deux magasins peuvent malgré tout tomber sur le même trigramme. `taken` reçoit alors ceux qui
 * sont déjà pris, et on avance d'une lettre : Carrefour Meximieux donne CMX, le suivant CME, puis
 * CMI. Les candidats sont tirés du nom, dans son ordre, pour que le trigramme reste reconnaissable
 * même quand ce n'est plus le premier choix.
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

	// Tout est pris, jusqu'aux suffixes chiffrés. Rendre une pastille vide serait pire que rendre
	// un doublon : au moins le doublon dit de quelle enseigne il s'agit.
	return premier;
}

/** Les trigrammes possibles pour ce nom, du plus parlant au plus lointain. */
function* candidats(name: string): Generator<string> {
	const mots = slugify(name)
		.split('-')
		.filter(Boolean)
		.map((mot) => mot.toUpperCase());

	if (mots.length === 0) {
		// Un nom sans lettre ni chiffre — un emoji seul, « ### ». slugify le vide entièrement ;
		// plutôt qu'une pastille blanche, on garde ce qui a été tapé. Le découpage passe par les
		// points de code, sinon un emoji serait coupé en deux moitiés de paire de substitution.
		const brut = [...name.trim().replaceAll(/\s+/g, '')].slice(0, LONGUEUR).join('').toUpperCase();
		if (brut) yield* avecSuffixes(brut);
		return;
	}

	const lettres = mots.join('');

	// Un nom plus court que le trigramme ne se raccourcit pas : « U », « Bio ».
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
		// Un mot d'une seule lettre — le « U » de Super U — n'a pas de dernière lettre distincte de
		// son initiale. Le filtre plus bas s'en charge, et on complète alors depuis le nom entier.
		preferees = [dernier.at(-1)];
	} else {
		base = mots[0][0] + mots[1][0];
		preferees = [mots[2][0], dernier.at(-1)];
	}

	// La suite des candidats vient d'abord du dernier mot — c'est la commune qui distingue deux
	// magasins de la même enseigne, pas l'enseigne —, puis du nom entier. On saute la première
	// lettre, déjà prise comme initiale, et toute lettre qui doublerait celle d'avant : « SUU » ne
	// se lit pas.
	const suite = [...preferees, ...dernier.slice(1), ...lettres.slice(1)].filter(
		(lettre): lettre is string => Boolean(lettre) && lettre !== base.at(-1)
	);

	for (const lettre of new Set(suite)) yield base + lettre;

	yield* suffixes(base);
}

/** Dernier recours : le même début, numéroté. */
function* suffixes(base: string): Generator<string> {
	for (const chiffre of '23456789') yield base + chiffre;
}

function* avecSuffixes(court: string): Generator<string> {
	yield court;
	yield* suffixes(court.slice(0, 2));
}
