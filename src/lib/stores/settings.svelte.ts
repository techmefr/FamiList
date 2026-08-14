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

				root.classList.toggle('dark', this.isDark);
				root.dataset.accent = this.accentId;
				root.dataset.scale = this.fontScaleId;

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
