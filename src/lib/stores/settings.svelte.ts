import { browser } from '$app/environment';
import { localWins as arbitrate, type AppearanceRow } from '$domain/appearance';
import { isHand, type Hand } from '$domain/hand';
import { animates, isMotionPreference, type MotionPreference } from '$domain/motion';
import {
	ACCENT_PRESETS,
	DEFAULT_ACCENT,
	DEFAULT_FONT,
	DEFAULT_FONT_SCALE,
	DEFAULT_HAND,
	DEFAULT_HAPTICS,
	DEFAULT_MOTION,
	DEFAULT_NEARBY_CARDS,
	DEFAULT_SOUND,
	FONT_PRESETS,
	FONT_SCALE_PRESETS,
	STORAGE_KEY,
	THEME_COLORS,
	type Theme
} from './preferences';

export { ACCENT_PRESETS, FONT_PRESETS, FONT_SCALE_PRESETS, type Theme };
export { MOTION_PREFERENCES, type MotionPreference } from '$domain/motion';
export { HANDS, type Hand } from '$domain/hand';
export type { AppearanceRow } from '$domain/appearance';

const THEMES: Theme[] = ['light', 'dark', 'system'];

class Settings {
	theme = $state<Theme>('system');
	accentId = $state<string>(DEFAULT_ACCENT);
	fontScaleId = $state<string>(DEFAULT_FONT_SCALE);
	fontId = $state<string>(DEFAULT_FONT);
	motion = $state<MotionPreference>(DEFAULT_MOTION);
	hand = $state<Hand>(DEFAULT_HAND);
	sound = $state(DEFAULT_SOUND);
	haptics = $state(DEFAULT_HAPTICS);
	nearbyCards = $state(DEFAULT_NEARBY_CARDS);
	hasSeenTour = $state(false);

	/**
	 * The welcome journey plays before an account exists: this marker therefore stays on the device and
	 * does not go to the database, unlike the guided tour's.
	 */
	hasSeenWelcome = $state(false);
	#prefersDark = $state(false);
	#prefersReducedMotion = $state(false);

	/**
	 * Sync timestamps. Deliberately outside `$state`: the effect that saves the preferences reads them, and
	 * making them reactive would have it re-trigger itself in a loop.
	 *
	 * `#syncedFor` remembers which account the last send served. Without it, there is no telling "I have
	 * just set my text size during the welcome, before even having an account" — where the device is right
	 * — from "I am opening the application on the tablet" — where the database is right.
	 */
	#changedAt = 0;
	#syncedAt = 0;
	#syncedFor: string | null = null;

	isDark = $derived(this.theme === 'dark' || (this.theme === 'system' && this.#prefersDark));

	/**
	 * The only place answering "do we animate". Svelte transitions receive a duration computed in
	 * JavaScript, the CSS has its own guard on `data-motion`: the two must say the same thing, so they must
	 * start from the same value.
	 */
	animates = $derived(animates(this.motion, this.#prefersReducedMotion));

	constructor() {
		if (!browser) return;

		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
			if (saved.theme) this.theme = saved.theme;
			if (saved.accentId) this.accentId = saved.accentId;
			if (saved.fontScaleId) this.fontScaleId = saved.fontScaleId;
			if (saved.fontId) this.fontId = saved.fontId;
			if (isMotionPreference(saved.motion)) this.motion = saved.motion;
			if (isHand(saved.hand)) this.hand = saved.hand;
			if (typeof saved.sound === 'boolean') this.sound = saved.sound;
			if (typeof saved.haptics === 'boolean') this.haptics = saved.haptics;
			if (typeof saved.nearbyCards === 'boolean') this.nearbyCards = saved.nearbyCards;
			if (typeof saved.hasSeenTour === 'boolean') this.hasSeenTour = saved.hasSeenTour;
			if (typeof saved.hasSeenWelcome === 'boolean') this.hasSeenWelcome = saved.hasSeenWelcome;
			if (typeof saved.changedAt === 'number') this.#changedAt = saved.changedAt;
			if (typeof saved.syncedAt === 'number') this.#syncedAt = saved.syncedAt;
			if (typeof saved.syncedFor === 'string') this.#syncedFor = saved.syncedFor;
		} catch {
			// unreadable preferences, we keep the defaults
		}

		const dark = matchMedia('(prefers-color-scheme: dark)');
		this.#prefersDark = dark.matches;
		dark.addEventListener('change', (event) => {
			this.#prefersDark = event.matches;
		});

		const reduced = matchMedia('(prefers-reduced-motion: reduce)');
		this.#prefersReducedMotion = reduced.matches;
		reduced.addEventListener('change', (event) => {
			this.#prefersReducedMotion = event.matches;
		});

		$effect.root(() => {
			$effect(() => {
				const root = document.documentElement;

				root.classList.toggle('dark', this.isDark);
				root.dataset.accent = this.accentId;
				root.dataset.scale = this.fontScaleId;
				root.dataset.font = this.fontId;
				root.dataset.motion = this.motion;
				root.dataset.hand = this.hand;

				// The system status bar follows the chosen theme, not the device's.
				document
					.querySelector('meta[name="theme-color"]')
					?.setAttribute('content', this.isDark ? THEME_COLORS.dark : THEME_COLORS.light);

				localStorage.setItem(
					STORAGE_KEY,
					JSON.stringify({
						theme: this.theme,
						accentId: this.accentId,
						fontScaleId: this.fontScaleId,
						fontId: this.fontId,
						motion: this.motion,
						hand: this.hand,
						sound: this.sound,
						haptics: this.haptics,
						nearbyCards: this.nearbyCards,
						hasSeenTour: this.hasSeenTour,
						hasSeenWelcome: this.hasSeenWelcome,
						changedAt: this.#changedAt,
						syncedAt: this.#syncedAt,
						syncedFor: this.#syncedFor
					})
				);
			});
		});
	}

	/** Every change coming from the interface goes through here, to date the change. */
	#touch() {
		this.#changedAt = Date.now();
	}

	setTheme(theme: Theme) {
		if (!THEMES.includes(theme)) return;
		this.#touch();
		this.theme = theme;
	}

	setAccent(id: string) {
		if (!ACCENT_PRESETS.some((a) => a.id === id)) return;
		this.#touch();
		this.accentId = id;
	}

	setFontScale(id: string) {
		if (!FONT_SCALE_PRESETS.some((f) => f.id === id)) return;
		this.#touch();
		this.fontScaleId = id;
	}

	setFont(id: string) {
		if (!FONT_PRESETS.some((f) => f.id === id)) return;
		this.#touch();
		this.fontId = id;
	}

	setMotion(preference: MotionPreference) {
		if (!isMotionPreference(preference)) return;
		this.#touch();
		this.motion = preference;
	}

	setHand(hand: Hand) {
		if (!isHand(hand)) return;
		this.#touch();
		this.hand = hand;
	}

	setSound(enabled: boolean) {
		this.#touch();
		this.sound = enabled;
	}

	setHaptics(enabled: boolean) {
		this.#touch();
		this.haptics = enabled;
	}

	setNearbyCards(enabled: boolean) {
		this.#touch();
		this.nearbyCards = enabled;
	}

	setTourSeen(seen: boolean) {
		this.#touch();
		this.hasSeenTour = seen;
	}

	setWelcomeSeen(seen: boolean) {
		this.hasSeenWelcome = seen;
	}

	/**
	 * Forgets which account this device last arbitrated its appearance for.
	 *
	 * Called on sign-out, alongside the local data cache being emptied: without it, a shared device hands
	 * the next account the previous one's `hasSeenTour` and sync bookkeeping. `localWins` would then read
	 * a `syncedFor` that matches neither account and a `hasSeenTour` that was never this account's to
	 * begin with — the guided tour silently skips itself for someone who has genuinely never seen it here,
	 * until (if ever) a later pull happens to correct it. Resetting the bookkeeping to its pre-sync state
	 * forces a clean pull for whoever signs in next.
	 */
	forgetAccount() {
		this.hasSeenTour = false;
		this.#changedAt = 0;
		this.#syncedAt = 0;
		this.#syncedFor = null;
		this.persist();
	}

	/** See `localWins` in `$domain/appearance` — kept there so the arbitration itself is testable without a store. */
	localWins(userId: string) {
		return arbitrate(
			{ changedAt: this.#changedAt, syncedAt: this.#syncedAt, syncedFor: this.#syncedFor },
			userId
		);
	}

	snapshot(): AppearanceRow {
		return {
			theme: this.theme,
			accent_id: this.accentId,
			type_scale: this.fontScaleId,
			font_id: this.fontId,
			motion: this.motion,
			hand: this.hand,
			sound: this.sound,
			haptics: this.haptics,
			nearby_cards: this.nearbyCards,
			has_seen_tour: this.hasSeenTour
		};
	}

	/**
	 * Applies what the database says. Each value is revalidated: the SQL constraint and the list of presets
	 * can diverge for the duration of a deployment, and an unknown value must leave the default in place
	 * rather than set a `data-accent` the CSS does not know.
	 */
	adoptRemote(row: Partial<AppearanceRow>, userId: string) {
		if (THEMES.includes(row.theme as Theme)) this.theme = row.theme as Theme;
		if (ACCENT_PRESETS.some((a) => a.id === row.accent_id)) this.accentId = row.accent_id as string;
		if (FONT_SCALE_PRESETS.some((f) => f.id === row.type_scale))
			this.fontScaleId = row.type_scale as string;
		if (FONT_PRESETS.some((f) => f.id === row.font_id)) this.fontId = row.font_id as string;
		if (isMotionPreference(row.motion)) this.motion = row.motion;
		if (isHand(row.hand)) this.hand = row.hand;
		if (typeof row.sound === 'boolean') this.sound = row.sound;
		if (typeof row.haptics === 'boolean') this.haptics = row.haptics;
		if (typeof row.nearby_cards === 'boolean') this.nearbyCards = row.nearby_cards;
		if (typeof row.has_seen_tour === 'boolean') this.hasSeenTour = row.has_seen_tour;

		this.markSynced(userId);
	}

	markSynced(userId: string) {
		this.#syncedFor = userId;
		this.#syncedAt = Date.now();
		this.#changedAt = this.#syncedAt;

		// The effect only watches reactive values: without this write, the timestamp would stay in memory and
		// the next start would send everything a second time.
		this.persist();
	}

	persist() {
		if (!browser) return;

		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				...saved,
				changedAt: this.#changedAt,
				syncedAt: this.#syncedAt,
				syncedFor: this.#syncedFor
			})
		);
	}
}

export const settings = new Settings();

/**
 * Duration of a Svelte transition, cut to nothing when motion is refused. Passing 0 rather than removing
 * the directive keeps the same code on both sides, and the element still appears.
 */
export const motionMs = (ms: number) => (settings.animates ? ms : 0);
