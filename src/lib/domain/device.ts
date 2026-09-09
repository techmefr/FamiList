/**
 * Reconnaître un appareil dans une liste de sessions.
 *
 * La question posée devant cette liste est toujours la même : « laquelle est ma tablette ? ». Un
 * en-tête `User-Agent` brut n'y répond pas — il fait deux cents caractères et cite trois
 * navigateurs qui n'y sont pour rien. On en tire deux mots.
 *
 * L'exercice est notoirement approximatif : les navigateurs se déclarent les uns les autres depuis
 * trente ans, et les versions récentes mentent de plus en plus. On vise donc « assez juste pour
 * reconnaître le sien parmi trois », pas l'exactitude.
 */

export interface DeviceLabel {
	browser: string;
	platform: string;
}

/** L'ordre compte : Edge se déclare Chrome, Chrome se déclare Safari. Le plus précis d'abord. */
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

/** L'application installée se signale elle-même : inutile de deviner son moteur de rendu. */
const NATIVE = /\bFamiList\b|\bCapacitor\b/;

function match(pairs: [RegExp, string][], agent: string): string {
	return pairs.find(([pattern]) => pattern.test(agent))?.[1] ?? '';
}

/**
 * Le navigateur et le système, ou des chaînes vides quand on ne sait pas.
 *
 * Ne rien inventer est important ici : afficher « Chrome sur Windows » pour une session qu'on n'a
 * pas su lire ferait fermer la mauvaise, ou garder ouverte celle qu'on cherchait.
 */
export function deviceLabel(userAgent: string | null | undefined): DeviceLabel {
	const agent = (userAgent ?? '').trim();
	if (agent === '') return { browser: '', platform: '' };

	const platform = match(PLATFORMS, agent);

	if (NATIVE.test(agent)) return { browser: 'FamiList', platform };

	return { browser: match(BROWSERS, agent), platform };
}

/** Les deux morceaux en une ligne, avec le mot de liaison fourni par la langue. */
export function deviceText(label: DeviceLabel, on: string, unknown: string): string {
	if (label.browser && label.platform) return `${label.browser} ${on} ${label.platform}`;

	return label.browser || label.platform || unknown;
}
