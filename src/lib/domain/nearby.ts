/**
 * Quelle carte de fidélité sortir quand on arrive devant un magasin.
 *
 * Tout est pur et sans plateforme : la géométrie, le choix du magasin, la règle qui évite de
 * renotifier. La couche native ne fait que lire une position et afficher ce qui est décidé ici.
 */

export interface NearbyShop {
	shopId: string;
	name: string;
	brand: string;
	lat?: number;
	lng?: number;
}

export interface NearbyCard {
	cardId: string;
	name: string;
	/** Rattachement à un magasin précis, vide quand la carte vaut pour toute une enseigne. */
	shopId: string;
	brand: string;
}

export interface NearbyPosition {
	lat: number;
	lng: number;
}

export interface NearbyAlert {
	shopId: string;
	shopName: string;
	cardId: string;
	cardName: string;
	/** Identifiant entier exigé par les notifications locales, dérivé de l'identifiant magasin. */
	id: number;
	meters: number;
}

/**
 * Le rayon de déclenchement, volontairement large.
 *
 * Trois cents mètres, c'est le parking et la rue d'en face : on est encore dehors, la carte est
 * prête avant la caisse. Plus serré, il faudrait une position au mètre près, donc le GPS à pleine
 * puissance en permanence — la batterie n'y survivrait pas, et une position à cinquante mètres
 * d'erreur, ce qui est courant en ville, raterait purement et simplement le magasin.
 */
export const NEARBY_RADIUS_M = 300;

/**
 * Le délai minimum entre deux vérifications.
 *
 * L'appareil peut rendre une position toutes les secondes ; on n'en a aucun besoin. À pied comme
 * en voiture, trois minutes ne font pas traverser un rayon de trois cents mètres sans qu'aucune
 * mesure ne tombe dedans, et c'est autant de calculs et de réveils économisés.
 */
export const NEARBY_CHECK_MS = 3 * 60 * 1000;

const EARTH_RADIUS_M = 6_371_000;

const radians = (degres: number) => (degres * Math.PI) / 180;

/**
 * La distance entre deux points, à vol d'oiseau.
 *
 * Formule de haversine : la Terre est traitée comme une sphère, ce qui laisse une erreur de
 * quelques mètres sur les distances qui nous intéressent. Largement sous le rayon de
 * déclenchement, et sans aucune dépendance.
 */
export function distanceMeters(a: NearbyPosition, b: NearbyPosition): number {
	const dLat = radians(b.lat - a.lat);
	const dLng = radians(b.lng - a.lng);
	const arc =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;

	return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(arc)));
}

const normalise = (texte: string) => texte.trim().toLowerCase();

/**
 * La carte à sortir pour ce magasin, s'il y en a une.
 *
 * Le rattachement direct gagne sur l'enseigne : une carte posée sur le Carrefour de Meximieux est
 * plus précise qu'une carte Carrefour valable partout. À défaut, l'enseigne suffit — c'est le cas
 * courant, et c'est exactement ce que la migration qui a ajouté `brand` avait en tête.
 *
 * Rien n'est rendu quand aucune carte ne correspond : il n'y a alors rien à proposer, et une
 * notification vide serait pire que le silence.
 */
export function cardForShop(shop: NearbyShop, cards: NearbyCard[]): NearbyCard | null {
	const parMagasin = cards.find((card) => card.shopId === shop.shopId);
	if (parMagasin) return parMagasin;

	const enseigne = normalise(shop.brand ?? '');
	if (!enseigne) return null;

	return cards.find((card) => normalise(card.brand) === enseigne) ?? null;
}

/** Le jour vécu, dans le fuseau de l'appareil : c'est l'unité de la règle anti-répétition. */
export function nearbyDay(now: Date): string {
	const mois = `${now.getMonth() + 1}`.padStart(2, '0');
	const jour = `${now.getDate()}`.padStart(2, '0');

	return `${now.getFullYear()}-${mois}-${jour}`;
}

/**
 * Un entier stable pour un magasin, dans une plage réservée.
 *
 * Les notifications locales s'identifient par un entier. Le décalage évite de retomber sur un
 * identifiant de rappel de liste, calculé de la même façon mais à partir d'un autre UUID : deux
 * notifications qui partagent un numéro se remplacent l'une l'autre dans le volet.
 */
export const NEARBY_ID_OFFSET = 1_000_000_000;

export function nearbyId(shopId: string): number {
	let hash = 0;
	for (const caractere of shopId) hash = (hash * 31 + caractere.charCodeAt(0)) | 0;

	return NEARBY_ID_OFFSET + (Math.abs(hash) % 1_000_000_000);
}

/**
 * Le magasin à annoncer, maintenant, ou rien.
 *
 * Un seul à la fois, et c'est le plus proche : dans une zone commerciale, trois enseignes se
 * chevauchent, et trois notifications d'un coup sont trois fois plus faciles à balayer sans les
 * lire. Celui devant lequel on est vraiment est celui dont on est le plus près.
 *
 * `notified` porte le dernier jour annoncé par magasin. Repasser devant le même magasin le même
 * jour ne redit rien : on y va rarement deux fois, et l'oubli de la carte ne se produit qu'à la
 * première visite. Le lendemain, la question se repose d'elle-même.
 *
 * Un magasin sans position est ignoré : « pas encore relevée » n'est pas une position.
 */
export function nearbyAlert(
	position: NearbyPosition,
	shops: NearbyShop[],
	cards: NearbyCard[],
	notified: Record<string, string>,
	now: Date,
	radius: number = NEARBY_RADIUS_M
): NearbyAlert | null {
	const aujourdhui = nearbyDay(now);
	let meilleur: NearbyAlert | null = null;

	for (const shop of shops) {
		if (typeof shop.lat !== 'number' || typeof shop.lng !== 'number') continue;
		if (notified[shop.shopId] === aujourdhui) continue;

		const meters = distanceMeters(position, { lat: shop.lat, lng: shop.lng });
		if (meters > radius) continue;

		const card = cardForShop(shop, cards);
		if (!card) continue;

		if (meilleur && meilleur.meters <= meters) continue;

		meilleur = {
			shopId: shop.shopId,
			shopName: shop.name,
			cardId: card.cardId,
			cardName: card.name,
			id: nearbyId(shop.shopId),
			meters
		};
	}

	return meilleur;
}

/**
 * Le journal des annonces, réduit au strict nécessaire.
 *
 * Seul le jour courant est conservé : la règle ne regarde pas plus loin, et garder l'historique
 * d'un magasin supprimé il y a six mois ne sert personne.
 */
export function rememberNotified(
	notified: Record<string, string>,
	shopId: string,
	now: Date
): Record<string, string> {
	const aujourdhui = nearbyDay(now);
	const garde: Record<string, string> = {};

	for (const [id, jour] of Object.entries(notified)) {
		if (jour === aujourdhui) garde[id] = jour;
	}

	garde[shopId] = aujourdhui;
	return garde;
}
