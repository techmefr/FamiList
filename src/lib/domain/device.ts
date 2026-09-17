/**
 * Recognising a device in a list of sessions.
 *
 * The question asked in front of that list is always the same: "which one is my tablet?". A raw `User-Agent`
 * header does not answer it — it is two hundred characters long and names three browsers that have nothing
 * to do with it. We pull two words out of it.
 *
 * The exercise is notoriously approximate: browsers have been declaring themselves as one another for
 * thirty years, and recent versions lie more and more. So we aim for "right enough to recognise your own
 * among three", not for accuracy.
 */

export interface DeviceLabel {
	browser: string;
	platform: string;
}

/** Order matters: Edge declares itself Chrome, Chrome declares itself Safari. Most precise first. */
const BROWSERS: [RegExp, string][] = [
	[/\bEdgA?\//, 'Edge'],
	[/\bOPR\/|\bOpera\//, 'Opera'],
	[/\bSamsungBrowser\//, 'Samsung Internet'],
	[/\bFirefox\/|\bFxiOS\//, 'Firefox'],
	[/\bChrome\/|\bCriOS\//, 'Chrome'],
	[/\bSafari\//, 'Safari']
];

const PLATFORMS: [RegExp, string][] = [
	[/\bAndroid\b/, 'Android'],
	[/\biPhone\b/, 'iPhone'],
	[/\biPad\b/, 'iPad'],
	[/\bWindows\b/, 'Windows'],
	[/\bMac OS X\b|\bMacintosh\b/, 'Mac'],
	[/\bCrOS\b/, 'ChromeOS'],
	[/\bLinux\b/, 'Linux']
];

/** The installed application reports itself: no need to guess its rendering engine. */
const NATIVE = /\bFamiList\b|\bCapacitor\b/;

function match(pairs: [RegExp, string][], agent: string): string {
	return pairs.find(([pattern]) => pattern.test(agent))?.[1] ?? '';
}

/**
 * The browser and the system, or empty strings when we do not know.
 *
 * Inventing nothing matters here: showing "Chrome on Windows" for a session we failed to read would get the
 * wrong one closed, or keep open the one being looked for.
 */
export function deviceLabel(userAgent: string | null | undefined): DeviceLabel {
	const agent = (userAgent ?? '').trim();
	if (agent === '') return { browser: '', platform: '' };

	const platform = match(PLATFORMS, agent);

	if (NATIVE.test(agent)) return { browser: 'FamiList', platform };

	return { browser: match(BROWSERS, agent), platform };
}

/** The two pieces on one line, with the joining word supplied by the language. */
export function deviceText(label: DeviceLabel, on: string, unknown: string): string {
	if (label.browser && label.platform) return `${label.browser} ${on} ${label.platform}`;

	return label.browser || label.platform || unknown;
}
