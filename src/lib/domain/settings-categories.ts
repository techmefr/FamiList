import { LEGAL_DOCUMENTS } from './legal';

export type SettingsCategoryId =
	| 'account'
	| 'household'
	| 'display'
	| 'feedback'
	| 'security'
	| 'ai'
	| 'images'
	| 'connection'
	| 'help'
	| 'legal'
	| 'admin';

/** One setting a search can land on: `anchor` is the id of its block on the category's screen. */
export interface SettingEntry {
	anchor: string;
	label: string;
	hint?: string;
}

export interface SettingsCategory {
	id: SettingsCategoryId;
	route: string;
	title: string;
	hint: string;
	/** A translated, comma-separated list of the words people use for what the category holds. */
	keywords: string;
	adminOnly?: boolean;
	settings: SettingEntry[];
}

const keys = (id: SettingsCategoryId) => ({
	hint: `profile.categories.${id}.hint`,
	keywords: `profile.categories.${id}.keywords`
});

/**
 * Every setting of the application, and the one screen it lives on.
 *
 * The profile list, its search and the anchors on each screen all read this: a setting added to a screen
 * without an entry here cannot be found by searching, and one listed under two categories would have two
 * homes — the very confusion the categories replace.
 */
export const SETTINGS_CATEGORIES: SettingsCategory[] = [
	{
		id: 'account',
		route: '/profile/account',
		title: 'profile.account',
		...keys('account'),
		settings: [
			{ anchor: 'setting-name', label: 'profile.name', hint: 'profile.nameHint' },
			{ anchor: 'setting-avatar', label: 'profile.avatar', hint: 'profile.avatarHint' },
			{ anchor: 'setting-sign-out', label: 'auth.signOut' }
		]
	},
	{
		id: 'household',
		route: '/household',
		title: 'profile.categories.household.title',
		...keys('household'),
		settings: [
			{ anchor: 'setting-members', label: 'household.members' },
			{ anchor: 'setting-people', label: 'household.people', hint: 'household.peopleHint' },
			{ anchor: 'setting-invite', label: 'household.inviteTitle' },
			{ anchor: 'setting-join', label: 'household.joinTitle' }
		]
	},
	{
		id: 'display',
		route: '/profile/display',
		title: 'profile.categories.display.title',
		...keys('display'),
		settings: [
			{ anchor: 'setting-text-size', label: 'profile.textSize', hint: 'profile.previewNote' },
			{ anchor: 'setting-font', label: 'profile.font', hint: 'profile.fontNote' },
			{ anchor: 'setting-theme', label: 'profile.theme' },
			{ anchor: 'setting-accent', label: 'profile.accent' },
			{ anchor: 'setting-hand', label: 'profile.hand', hint: 'profile.handHint' },
			{ anchor: 'setting-language', label: 'profile.language' }
		]
	},
	{
		id: 'feedback',
		route: '/profile/feedback',
		title: 'profile.categories.feedback.title',
		...keys('feedback'),
		settings: [
			{ anchor: 'setting-motion', label: 'profile.motion', hint: 'profile.motionHint' },
			{ anchor: 'setting-sound', label: 'profile.sound', hint: 'profile.soundHint' },
			{ anchor: 'setting-haptics', label: 'profile.haptics', hint: 'profile.hapticsHint' },
			{ anchor: 'setting-nearby', label: 'profile.nearbyCards' }
		]
	},
	{
		id: 'security',
		route: '/profile/security',
		title: 'security.title',
		...keys('security'),
		settings: [
			{ anchor: 'setting-password', label: 'security.passwordTitle' },
			{ anchor: 'setting-two-factor', label: 'security.twoFactor' },
			{ anchor: 'setting-sessions', label: 'security.sessionsTitle' },
			{ anchor: 'setting-data', label: 'security.dataTitle' },
			{ anchor: 'setting-delete', label: 'security.deleteTitle' }
		]
	},
	{
		id: 'ai',
		route: '/profile/ai',
		title: 'ai.title',
		...keys('ai'),
		settings: [
			{ anchor: 'setting-ai-privacy', label: 'ai.privacyTitle' },
			{ anchor: 'setting-ai-key', label: 'ai.keyTitle' }
		]
	},
	{
		id: 'images',
		route: '/profile/images',
		title: 'imageBanks.title',
		...keys('images'),
		settings: []
	},
	{
		id: 'connection',
		route: '/profile/connection',
		title: 'connection.title',
		...keys('connection'),
		settings: []
	},
	{
		id: 'help',
		route: '/profile/help',
		title: 'profile.help',
		...keys('help'),
		settings: [{ anchor: 'setting-tour', label: 'profile.replayTour', hint: 'profile.tourHint' }]
	},
	{
		id: 'legal',
		route: '/profile/legal',
		title: 'profile.categories.legal.title',
		...keys('legal'),
		settings: [
			...LEGAL_DOCUMENTS.map((id) => ({ anchor: `setting-legal-${id}`, label: `legal.${id}` })),
			{ anchor: 'setting-privacy-request', label: 'legal.makeRequest' }
		]
	},
	{
		id: 'admin',
		route: '/profile/admin',
		title: 'profile.administration',
		...keys('admin'),
		adminOnly: true,
		settings: []
	}
];

export function visibleCategories(isAdmin: boolean): SettingsCategory[] {
	return SETTINGS_CATEGORIES.filter((category) => isAdmin || !category.adminOnly);
}

export function categoryById(id: SettingsCategoryId): SettingsCategory {
	const category = SETTINGS_CATEGORIES.find((candidate) => candidate.id === id);
	if (!category) throw new Error(`Unknown settings category: ${id}`);
	return category;
}

export function settingHref(category: SettingsCategory, anchor?: string): string {
	return anchor ? `${category.route}#${anchor}` : category.route;
}

export interface SettingMatch {
	key: string;
	href: string;
	label: string;
	category: string;
}

/**
 * Case and accents are dropped on both sides: "theme" must find « Thème », and nobody types the accents of
 * a word they are only half sure of.
 */
export function normalizeSearch(text: string): string {
	return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

const UNSPACED_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;

const WORD_BREAK = /[\s\p{P}\p{S}]+/u;

const EXACT = 0;
const PREFIX = 1;

/**
 * How well a text answers every word of the query, or null when one word is missing.
 *
 * A word must start a word of the text: "son" finds « Son », not « personnelles ». A whole word ranks above
 * a mere start, so « Son » comes before « ce sont ». Chinese writes no spaces between words, so there any
 * position counts, as a whole word.
 */
function matchQuality(haystack: string, words: string[]): number | null {
	const tokens = haystack.split(WORD_BREAK).filter(Boolean);
	let quality = EXACT;

	for (const word of words) {
		if (UNSPACED_SCRIPT.test(word)) {
			if (!haystack.includes(word)) return null;
		} else if (!tokens.includes(word)) {
			if (!tokens.some((token) => token.startsWith(word))) return null;
			quality = PREFIX;
		}
	}

	return quality;
}

/**
 * The settings answering a query: whole-word answers first, then the rest, each in the order of the
 * profile list.
 *
 * Every word must appear, in any order. A setting is found by its own label and hint; a category by its
 * title, hint and keywords — the keywords carry the words people use for a setting ("dark", "bigger")
 * without naming it, and then the category's screen is the answer. A category is only offered on its own
 * when none of its settings matched, so the same screen is not listed twice.
 */
export function searchSettings(
	query: string,
	categories: SettingsCategory[],
	translate: (key: string) => string
): SettingMatch[] {
	const words = normalizeSearch(query).split(WORD_BREAK).filter(Boolean);
	if (words.length === 0) return [];

	const ranked: Array<{ match: SettingMatch; quality: number }> = [];

	for (const category of categories) {
		const categoryTitle = translate(category.title);
		let settingFound = false;

		for (const setting of category.settings) {
			const quality = matchQuality(
				normalizeSearch(`${translate(setting.label)} ${setting.hint ? translate(setting.hint) : ''}`),
				words
			);
			if (quality === null) continue;

			settingFound = true;
			ranked.push({
				quality,
				match: {
					key: `${category.id}:${setting.anchor}`,
					href: settingHref(category, setting.anchor),
					label: translate(setting.label),
					category: categoryTitle
				}
			});
		}

		if (settingFound) continue;

		const quality = matchQuality(
			normalizeSearch(`${categoryTitle} ${translate(category.hint)} ${translate(category.keywords)}`),
			words
		);
		if (quality === null) continue;

		ranked.push({
			quality,
			match: { key: category.id, href: category.route, label: categoryTitle, category: categoryTitle }
		});
	}

	return ranked.sort((a, b) => a.quality - b.quality).map(({ match }) => match);
}
