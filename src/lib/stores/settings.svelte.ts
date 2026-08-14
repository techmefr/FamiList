import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';
export type TypeScale = 'compact' | 'normal' | 'large';

const STORAGE_KEY = 'familist:appearance';

class Settings {
	theme = $state<Theme>('system');
	typeScale = $state<TypeScale>('normal');
	#prefersDark = $state(false);

	isDark = $derived(this.theme === 'dark' || (this.theme === 'system' && this.#prefersDark));

	constructor() {
		if (!browser) return;

		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
			if (saved.theme) this.theme = saved.theme;
			if (saved.typeScale) this.typeScale = saved.typeScale;
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
				root.dataset.typeScale = this.typeScale;
				localStorage.setItem(
					STORAGE_KEY,
					JSON.stringify({ theme: this.theme, typeScale: this.typeScale })
				);
			});
		});
	}

	setTheme(theme: Theme) {
		this.theme = theme;
	}

	setTypeScale(scale: TypeScale) {
		this.typeScale = scale;
	}
}

export const settings = new Settings();
