import type { ReportKind } from '$domain/bug-report';

/**
 * The report being written.
 *
 * It lives here, outside any screen, for a precise reason: the panel must be able to shrink without losing
 * anything. What we want to show is behind it — the item displaying badly, the error message, the list that
 * got stuck — and the only way to capture it is to put the form away for the time of the gesture. If it
 * lived in the component, shrinking it would unmount it, and the description would have to be typed again.
 */
class ReportStore {
	/** The panel exists (open or shrunk). Closed, there is no draft at all any more. */
	open = $state(false);

	/** Shrunk: tucked away at the bottom, the screen becomes visible again, what was typed is kept. */
	minimized = $state(false);

	kind = $state<ReportKind>('bug');

	/** The screen the report starts from. Noted so as not to have to ask "where were you?". */
	path = $state('');

	description = $state('');
	screenshot = $state<string | null>(null);
	sent = $state(false);

	/** The short number returned by the database, shown to the person once the report is filed. */
	number = $state<number | null>(null);

	get hasDraft() {
		return this.description.trim() !== '' || this.screenshot !== null;
	}

	/**
	 * Opens the panel from the help menu.
	 *
	 * A draft already started is not overwritten: somebody who shrank the panel to go and take their
	 * screenshot, then comes back through the help menu instead of the "Resume" button, finds what they were
	 * writing. We then change neither the type nor the screen of origin — they belong to the report in
	 * progress.
	 */
	show(kind: ReportKind, path: string) {
		if (!this.hasDraft || this.sent) {
			this.kind = kind;
			this.path = path;
			this.description = '';
			this.screenshot = null;
			this.sent = false;
			this.number = null;
		}

		this.open = true;
		this.minimized = false;
	}

	minimize() {
		this.minimized = true;
	}

	restore() {
		this.minimized = false;
	}

	/** Closes and forgets. It is the only path that throws away what was written. */
	close() {
		this.open = false;
		this.minimized = false;
		this.description = '';
		this.screenshot = null;
		this.sent = false;
		this.number = null;
	}
}

export const report = new ReportStore();
