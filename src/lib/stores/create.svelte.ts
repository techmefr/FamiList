/**
 * Ce que le bouton central vient de demander, le temps d'arriver sur l'écran concerné.
 *
 * Les formulaires de magasin, de rayon et de carte sont déjà posés en permanence sur leur page : il
 * suffit d'y aller et de placer le curseur dans le premier champ. Celui d'une nouvelle liste, lui,
 * est replié — l'accueil doit savoir qu'on arrive pour le déplier. D'où ce relais, plutôt qu'un
 * paramètre d'URL qui resterait dans la barre d'adresse et rouvrirait le formulaire à chaque
 * rechargement.
 */
export type CreateKind = 'item' | 'list' | 'aisle' | 'shop' | 'card';

class CreateIntent {
	#kind = $state<CreateKind | null>(null);

	get kind() {
		return this.#kind;
	}

	request(kind: CreateKind) {
		this.#kind = kind;
	}

	/**
	 * Vrai une seule fois : le premier écran qui reconnaît l'intention la consomme. Sans cela, un
	 * retour en arrière sur l'accueil rouvrirait le formulaire alors que personne ne l'a demandé.
	 */
	take(kind: CreateKind) {
		if (this.#kind !== kind) return false;
		this.#kind = null;
		return true;
	}
}

export const createIntent = new CreateIntent();
