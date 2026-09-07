import { browser } from '$app/environment';
import { animates, isMotionPreference, type MotionPreference } from '$domain/motion';
import {
	ACCENT_PRESETS,
	DEFAULT_ACCENT,
	DEFAULT_FONT_SCALE,
	DEFAULT_HAPTICS,
	DEFAULT_MOTION,
	DEFAULT_SOUND,
	FONT_SCALE_PRESETS,
	STORAGE_KEY,
	THEME_COLORS,
	type Theme
} from './preferences';

export { ACCENT_PRESETS, FONT_SCALE_PRESETS, type Theme };
export { MOTION_PREFERENCES, type MotionPreference } from '$domain/motion';

class Settings {
	theme = $state<Theme>('system');
	accentId = $state<string>(DEFAULT_ACCENT);
	fontScaleId = $state<string>(DEFAULT_FONT_SCALE);
	motion = $state<MotionPreference>(DEFAULT_MOTION);
	sound = $state(DEFAULT_SOUND);
	haptics = $state(DEFAULT_HAPTICS);
	#prefersDark = $state(false);
	#prefersReducedMotion = $state(false);

	isDark = $derived(this.theme === 'dark' || (this.theme === 'system' && this.#prefersDark));

	/**
	 * Le seul endroit qui répond « est-ce qu'on anime ». Les transitions Svelte reçoivent une durée
	 * calculée en JavaScript, le CSS a son propre garde-fou sur `data-motion` : les deux doivent
	 * dire la même chose, donc partir de la même valeur.
	 */
	animates = $derived(animates(this.motion, this.#prefersReducedMotion));

	constructor() {
		if (!browser) return;

		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
			if (saved.theme) this.theme = saved.theme;
			if (saved.accentId) this.accentId = saved.accentId;
			if (saved.fontScaleId) this.fontScaleId = saved.fontScaleId;
			if (isMotionPreference(saved.motion)) this.motion = saved.motion;
			if (typeof saved.sound === 'boolean') this.sound = saved.sound;
			if (typeof saved.haptics === 'boolean') this.haptics = saved.haptics;
		} catch {
			// préférences illisibles, on garde les valeurs par défaut
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
				root.dataset.motion = this.motion;

				// La barre de statut du système suit le thème choisi, pas celui de l'appareil.
				document
					.querySelector('meta[name="theme-color"]')
					?.setAttribute('content', this.isDark ? THEME_COLORS.dark : THEME_COLORS.light);

				localStorage.setItem(
					STORAGE_KEY,
					JSON.stringify({
						theme: this.theme,
						accentId: this.accentId,
						fontScaleId: this.fontScaleId,
						motion: this.motion,
						sound: this.sound,
						haptics: this.haptics
					})
				);
			});
		});
	}

	setTheme(theme: Theme) {
		this.theme = theme;
	}

	setAccent(id: string) {
		if (ACCENT_PRESETS.some((a) => a.id === id)) this.accentId = id;
	}

	setFontScale(id: string) {
		if (FONT_SCALE_PRESETS.some((f) => f.id === id)) this.fontScaleId = id;
	}

	setMotion(preference: MotionPreference) {
		if (isMotionPreference(preference)) this.motion = preference;
	}

	setSound(enabled: boolean) {
		this.sound = enabled;
	}

	setHaptics(enabled: boolean) {
		this.haptics = enabled;
	}
}

export const settings = new Settings();

/**
 * Durée d'une transition Svelte, coupée net quand le mouvement est refusé. Passer 0 plutôt que de
 * retirer la directive garde le même code des deux côtés, et l'élément apparaît quand même.
 */
export const motionMs = (ms: number) => (settings.animates ? ms : 0);
