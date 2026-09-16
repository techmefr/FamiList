export interface DuplicableItem {
	aisleId: string;
	name: string;
	qty: string;
	unit: string;
	checked: boolean;
	priority: boolean;
	note?: string;
	assignedTo?: string;
}

export type ItemCopy = Omit<DuplicableItem, 'checked' | 'assignedTo'> & { checked: false };

const NUMBERED = /^(.*?)\s\((\d+)\)$/;

/**
 * Le nom de la copie : « Courses » devient « Courses (2) », puis « Courses (3) ».
 *
 * Le suffixe est un nombre et non un mot traduit : la liste est nommée par le foyer, qui peut
 * écrire dans une langue différente de celle de l'écran, et un « (copie) » figé dans le nom
 * resterait faux le jour où quelqu'un change de langue. Un rang se lit dans les dix langues.
 *
 * Dupliquer une copie repart du nom d'origine plutôt que d'empiler les parenthèses : on veut
 * « Courses (3) », pas « Courses (2) (2) ».
 */
export function copyName(name: string, existing: string[]): string {
	const source = name.trim();
	const numbered = NUMBERED.exec(source);
	const base = numbered ? numbered[1] : source;
	const taken = new Set(existing.map((entry) => entry.trim()));

	let rank = 2;
	while (taken.has(`${base} (${rank})`)) rank += 1;

	return `${base} (${rank})`;
}

/**
 * Ce qu'un article emporte dans la copie.
 *
 * Le rayon, la quantité, l'unité, la note et l'urgence décrivent le produit voulu : ce sont eux
 * qui font gagner du temps, et les retaper serait recréer la liste à la main.
 *
 * Deux champs restent en arrière, parce qu'ils décrivent la course passée et non le besoin :
 * l'état coché — une liste dupliquée est une liste à faire, pas une liste déjà faite — et
 * l'attribution à une personne, qui a été décidée pour cette sortie-là et que rien ne dit
 * reconduite la semaine suivante.
 */
export function copiedItem(item: DuplicableItem): ItemCopy {
	return {
		aisleId: item.aisleId,
		name: item.name,
		qty: item.qty,
		unit: item.unit,
		checked: false,
		priority: item.priority,
		note: item.note
	};
}
