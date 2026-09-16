/**
 * Rendu d'une liste en markdown, pour la sortir de l'application et la coller ailleurs.
 *
 * Le texte part dans une messagerie, pas dans un lecteur de markdown : WhatsApp, Signal et les SMS
 * affichent les caractères tels quels. Tout est donc choisi pour rester lisible sans rendu — les
 * dièses et les tirets se lisent comme des puces, et les mêmes caractères deviennent un vrai
 * document si la personne colle dans un outil qui, lui, interprète le markdown.
 *
 * Aucun mot de langue ici : les étiquettes (nom du rayon, unité) arrivent déjà traduites par
 * l'appelant. C'est ce qui rend la fonction pure, et testable sans démarrer l'i18n.
 */

export interface MarkdownItem {
	name: string;
	/** Quantité telle qu'elle a été saisie, vide quand personne n'en a mis. */
	qty: string;
	/** Unité déjà traduite, jamais la clef. Vide si l'unité n'a pas de sens ici. */
	unit: string;
	checked: boolean;
	priority: boolean;
	note?: string;
}

export interface MarkdownAisle {
	name: string;
	emoji: string;
	items: MarkdownItem[];
}

export interface MarkdownList {
	name: string;
	emoji: string;
	aisles: MarkdownAisle[];
}

/** Ce qui suit le nom : « 1 kg », « 3 », ou rien. L'unité seule ne veut rien dire, on la tait. */
function quantity(item: MarkdownItem): string {
	const qty = item.qty.trim();
	if (qty === '') return '';

	const unit = item.unit.trim();
	return unit === '' ? qty : `${qty} ${unit}`;
}

function line(item: MarkdownItem): string {
	const parts = [item.name.trim()];

	const qty = quantity(item);
	if (qty !== '') parts.push(`— ${qty}`);

	const note = item.note?.trim();
	if (note) parts.push(`_(${note})_`);

	const body = parts.join(' ');

	/**
	 * Un article déjà pris reste dans le texte, barré, plutôt que disparaître : la personne en face
	 * reçoit souvent la liste au milieu des courses, et « déjà acheté » est une information qu'elle
	 * n'a nulle part ailleurs. La case cochée suffit là où le barré n'est pas rendu.
	 */
	if (item.checked) return `- [x] ~~${body}~~`;

	/** L'étoile porte l'urgence, que la liste à puces seule aplatit. */
	return item.priority ? `- [ ] ⭐ ${body}` : `- [ ] ${body}`;
}

/** Un rayon créé à la main peut n'avoir aucun emoji : le titre ne doit pas garder son trou. */
function heading(level: string, emoji: string, name: string): string {
	return [level, emoji.trim(), name.trim()].filter((part) => part !== '').join(' ');
}

function aisleBlock(aisle: MarkdownAisle): string[] {
	return [heading('##', aisle.emoji, aisle.name), ...aisle.items.map(line)];
}

/**
 * La liste entière en un seul texte.
 *
 * Le titre est un `#` et les rayons des `##` : c'est la hiérarchie réelle, et elle se lit même sans
 * rendu. Les rayons vides sont omis — un intitulé sans rien dessous ferait croire à un oubli.
 */
export function listToMarkdown(list: MarkdownList): string {
	const title = heading('#', list.emoji, list.name);
	const blocks = list.aisles.filter((aisle) => aisle.items.length > 0).map(aisleBlock);

	return [title, ...blocks.map((block) => block.join('\n'))].join('\n\n');
}
