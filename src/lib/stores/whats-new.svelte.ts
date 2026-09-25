/**
 * Whether somebody asked for the "What's new" history from the help menu.
 *
 * Kept outside both components: the help menu opens it, `ChangelogModal` (mounted once in the layout) shows
 * it. Passing it down as a prop would mean threading it through the header of every screen that carries
 * the help button.
 */
class WhatsNewStore {
	open = $state(false);

	show() {
		this.open = true;
	}

	hide() {
		this.open = false;
	}
}

export const whatsNew = new WhatsNewStore();
