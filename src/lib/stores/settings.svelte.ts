import { browser } from '$app/environment';
import {
	ACCENT_PRESETS,
	DEFAULT_ACCENT,
	DEFAULT_FONT_SCALE,
	FONT_SCALE_PRESETS,
	STORAGE_KEY,
	type Theme
} from './preferences';

export { ACCENT_PRESETS, FONT_SCALE_PRESETS, type Theme };

class Settings {
	theme = $state<Theme>('system');
	accentId = $state<string>(DEFAULT_ACCENT);
	fontScaleId = $state<string>(DEFAULT_FONT_SCALE);
	#prefersDark = $state(false);

	isDark = $derived(this.theme === 'dark' || (this.theme === 'system' && this.#prefersDark));
	accent = $derived(ACCENT_PRESETS.find((a) => a.id === this.accentId) ?? ACCENT_PRESETS[0]);
	fontScale = $derived(
		FONT_SCALE_PRESETS.find((f) => f.id === this.fontScaleId) ?? FONT_SCALE_PRESETS[1]
	);

	constructor() {
		if (!browser) return;

		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
			if (saved.theme) this.theme = saved.theme;
			if (saved.accentId) this.accentId = saved.accentId;
			if (saved.fontScaleId) this.fontScaleId = saved.fontScaleId;
		} catch {
			// préférences illisibles, on garde les valeurs par défaut
		}

		const query = matchMedia('(prefers-color-scheme: dark)');
		this.#prefersDark = query.matches;
		query.addEventListener('change', (event) => {
			this.#prefersDark = event.matches;
		});

		$effect.root(() => {
			$effect(() => {
				const root = document.documentElement;
				const dark = this.isDark;
				const accent = this.accent;

				root.classList.toggle('dark', dark);
				root.style.setProperty('--primary', dark ? accent.dark : accent.light);
				root.style.setProperty('--ring', dark ? accent.dark : accent.light);
				root.style.setProperty('--fl-primary-tint', dark ? accent.tintDark : accent.tint);
				root.style.setProperty('--fl-font-scale', String(this.fontScale.scale));

				localStorage.setItem(
					STORAGE_KEY,
					JSON.stringify({
						theme: this.theme,
						accentId: this.accentId,
						fontScaleId: this.fontScaleId
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
}

export const settings = new Settings();
