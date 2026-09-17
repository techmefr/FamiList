/**
 * Rendering a list as markdown, to send it out of the application and paste it elsewhere.
 *
 * The text goes into a messaging app, not into a markdown reader: WhatsApp, Signal and SMS show the
 * characters as they are. Everything is therefore chosen to stay readable without rendering — hashes and
 * dashes read as bullets, and the same characters become a real document if the person pastes into a tool
 * that does interpret markdown.
 *
 * No language words here: the labels (aisle name, unit) arrive already translated from the caller. That is
 * what makes the function pure, and testable without starting the i18n.
 */

export interface MarkdownItem {
	name: string;
	/** Quantity as it was typed, empty when nobody put one. */
	qty: string;
	/** Unit already translated, never the key. Empty if the unit makes no sense here. */
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

/** What follows the name: "1 kg", "3", or nothing. A unit alone means nothing, so we leave it out. */
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
	 * An item already picked up stays in the text, struck through, rather than disappearing: the person on
	 * the other end often receives the list in the middle of the shopping, and "already bought" is
	 * information they have nowhere else. The ticked box is enough where the strikethrough is not rendered.
	 */
	if (item.checked) return `- [x] ~~${body}~~`;

	/** The star carries the urgency, which a bullet list alone flattens. */
	return item.priority ? `- [ ] ⭐ ${body}` : `- [ ] ${body}`;
}

/** An aisle created by hand may have no emoji: the heading must not keep its gap. */
function heading(level: string, emoji: string, name: string): string {
	return [level, emoji.trim(), name.trim()].filter((part) => part !== '').join(' ');
}

function aisleBlock(aisle: MarkdownAisle): string[] {
	return [heading('##', aisle.emoji, aisle.name), ...aisle.items.map(line)];
}

/**
 * The whole list as a single text.
 *
 * The title is a `#` and the aisles `##`: that is the real hierarchy, and it reads even without rendering.
 * Empty aisles are omitted — a heading with nothing under it would look like an oversight.
 */
export function listToMarkdown(list: MarkdownList): string {
	const title = heading('#', list.emoji, list.name);
	const blocks = list.aisles.filter((aisle) => aisle.items.length > 0).map(aisleBlock);

	return [title, ...blocks.map((block) => block.join('\n'))].join('\n\n');
}
