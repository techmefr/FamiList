import { browser } from '$app/environment';
import { animates, isMotionPreference, type MotionPreference } from '$domain/motion';
import {
	ACCENT_PRESETS,
	DEFAULT_ACCENT,
	DEFAULT_FONT,
	DEFAULT_FONT_SCALE,
	DEFAULT_HAPTICS,
	DEFAULT_MOTION,
	DEFAULT_SOUND,
	FONT_PRESETS,
	FONT_SCALE_PRESETS,
	STORAGE_KEY,
	THEME_COLORS,
	type Theme
} from './preferences';

export { ACCENT_PRESETS, FONT_PRESETS, FONT_SCALE_PRESETS, type Theme };
export { MOTION_PREFERENCES, type MotionPreference } from '$domain/motion';

const THEMES: Theme[] = ['light', 'dark', 'system'];

/** Les colonnes d'apparence de `profiles`, dans la forme attendue par la base. */
export interface AppearanceRow {
	theme: string;
	accent_id: string;
	type_scale: string;
	font_id: string;
	motion: string;
	sound: boolean;
	haptics: boolean;
	has_seen_tour: boolean;
}

class Settings {
	theme = $state<Theme>('system');
	accentId = $state<string>(DEFAULT_ACCENT);
	fontScaleId = $state<string>(DEFAULT_FONT_SCALE);
	fontId = $state<string>(DEFAULT_FONT);
	motion = $state<MotionPreference>(DEFAULT_MOTION);
	sound = $state(DEFAULT_SOUND);
	haptics = $state(DEFAULT_HAPTICS);
	hasSeenTour = $state(false);

	/**
	 * Le parcours d'accueil se joue avant qu'un compte existe : ce témoin reste donc sur
	 * l'appareil et ne part pas en base, contrairement à celui du tour guidé.
	 */
	hasSeenWelcome = $state(false);
	#prefersDark = $state(false);
	#prefersReducedMotion = $state(false);

	/**
	 * Horodatages de synchronisation. Volontairement hors de `$state` : l'effet qui enregistre les
	 * préférences les lit, et les rendre réactifs le ferait se redéclencher lui-même en boucle.
	 *
	 * `#syncedFor` retient à quel compte le dernier envoi a servi. Sans lui, impossible de
	 * distinguer « je viens de régler ma taille pendant l'accueil, avant même d'avoir un compte »
	 * — où c'est l'appareil qui a raison — de « j'ouvre l'application sur la tablette » — où c'est
	 * la base qui a raison.
	 */
	#changedAt = 0;
	#syncedAt = 0;
	#syncedFor: string | null = null;

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
			if (saved.fontId) this.fontId = saved.fontId;
			if (isMotionPreference(saved.motion)) this.motion = saved.motion;
			if (typeof saved.sound === 'boolean') this.sound = saved.sound;
			if (typeof saved.haptics === 'boolean') this.haptics = saved.haptics;
			if (typeof saved.hasSeenTour === 'boolean') this.hasSeenTour = saved.hasSeenTour;
			if (typeof saved.hasSeenWelcome === 'boolean') this.hasSeenWelcome = saved.hasSeenWelcome;
			if (typeof saved.changedAt === 'number') this.#changedAt = saved.changedAt;
			if (typeof saved.syncedAt === 'number') this.#syncedAt = saved.syncedAt;
			if (typeof saved.syncedFor === 'string') this.#syncedFor = saved.syncedFor;
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
				root.dataset.font = this.fontId;
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
						fontId: this.fontId,
						motion: this.motion,
						sound: this.sound,
						haptics: this.haptics,
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

	/** Toute modification venue de l'interface passe par ici, pour dater le changement. */
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

	setSound(enabled: boolean) {
		this.#touch();
		this.sound = enabled;
	}

	setHaptics(enabled: boolean) {
		this.#touch();
		this.haptics = enabled;
	}

	setTourSeen(seen: boolean) {
		this.#touch();
		this.hasSeenTour = seen;
	}

	setWelcomeSeen(seen: boolean) {
		this.hasSeenWelcome = seen;
	}

	/**
	 * Qui a raison, l'appareil ou la base, quand ce compte s'ouvre ici.
	 *
	 * L'appareil gagne dans deux cas : les réglages ont été touchés sans qu'aucun compte n'ait
	 * jamais reçu d'envoi — c'est le parcours d'accueil, où l'on choisit sa taille avant de créer
	 * son compte — ou bien ils ont changé depuis le dernier envoi réussi pour ce même compte, par
	 * exemple hors réseau. Partout ailleurs, c'est la base : on arrive sur un nouvel appareil.
	 */
	localWins(userId: string) {
		if (this.#syncedFor === null) return this.#changedAt > 0;

		return this.#syncedFor === userId && this.#changedAt > this.#syncedAt;
	}

	snapshot(): AppearanceRow {
		return {
			theme: this.theme,
			accent_id: this.accentId,
			type_scale: this.fontScaleId,
			font_id: this.fontId,
			motion: this.motion,
			sound: this.sound,
			haptics: this.haptics,
			has_seen_tour: this.hasSeenTour
		};
	}

	/**
	 * Applique ce que dit la base. Chaque valeur est revalidée : la contrainte SQL et la liste des
	 * préréglages peuvent diverger le temps d'un déploiement, et une valeur inconnue doit laisser
	 * la valeur par défaut plutôt que poser un `data-accent` que le CSS ne connaît pas.
	 */
	adoptRemote(row: Partial<AppearanceRow>, userId: string) {
		if (THEMES.includes(row.theme as Theme)) this.theme = row.theme as Theme;
		if (ACCENT_PRESETS.some((a) => a.id === row.accent_id)) this.accentId = row.accent_id as string;
		if (FONT_SCALE_PRESETS.some((f) => f.id === row.type_scale))
			this.fontScaleId = row.type_scale as string;
		if (FONT_PRESETS.some((f) => f.id === row.font_id)) this.fontId = row.font_id as string;
		if (isMotionPreference(row.motion)) this.motion = row.motion;
		if (typeof row.sound === 'boolean') this.sound = row.sound;
		if (typeof row.haptics === 'boolean') this.haptics = row.haptics;
		if (typeof row.has_seen_tour === 'boolean') this.hasSeenTour = row.has_seen_tour;

		this.markSynced(userId);
	}

	markSynced(userId: string) {
		this.#syncedFor = userId;
		this.#syncedAt = Date.now();
		this.#changedAt = this.#syncedAt;

		// L'effet ne surveille que les valeurs réactives : sans cette écriture, l'horodatage
		// resterait en mémoire et le prochain démarrage renverrait tout une seconde fois.
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
 * Durée d'une transition Svelte, coupée net quand le mouvement est refusé. Passer 0 plutôt que de
 * retirer la directive garde le même code des deux côtés, et l'élément apparaît quand même.
 */
export const motionMs = (ms: number) => (settings.animates ? ms : 0);
