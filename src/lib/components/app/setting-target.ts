/**
 * A setting found by the search is shown, not only scrolled to: at the largest text size the screen holds
 * one block, and a person who asked for "sound" must see at once that this is the one. Focus follows, so a
 * screen reader starts reading there too.
 */
export function highlightSettingTarget(url: URL | undefined): void {
	for (const previous of document.querySelectorAll('[data-highlight]')) {
		previous.removeAttribute('data-highlight');
	}

	const anchor = url?.hash.slice(1);
	const target = anchor ? document.getElementById(decodeURIComponent(anchor)) : null;
	if (!target) return;

	target.setAttribute('data-highlight', '');
	target.focus({ preventScroll: true });
}
