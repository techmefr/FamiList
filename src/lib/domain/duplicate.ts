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
 * The name of the copy: "Shopping" becomes "Shopping (2)", then "Shopping (3)".
 *
 * The suffix is a number and not a translated word: the list is named by the household, which may write in
 * a language other than the screen's, and a "(copy)" frozen into the name would stay wrong the day
 * somebody changes language. A rank reads in all ten languages.
 *
 * Duplicating a copy starts again from the original name rather than stacking brackets: we want
 * "Shopping (3)", not "Shopping (2) (2)".
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
 * What an item carries into the copy.
 *
 * The aisle, the quantity, the unit, the note and the urgency describe the wanted product: they are what
 * saves time, and typing them again would mean recreating the list by hand.
 *
 * Two fields stay behind, because they describe the past shopping trip and not the need: the ticked state —
 * a duplicated list is a list to do, not one already done — and the assignment to a person, which was
 * decided for that trip and which nothing says carries over to the following week.
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
