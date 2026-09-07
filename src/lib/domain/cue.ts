/**
 * Retours d'action : un son court, et la vibration qui l'accompagne.
 *
 * Les sons sont synthétisés à l'exécution, pas chargés. Un fichier par action, ce serait du réseau
 * au premier geste dans un magasin sans couverture, et du poids dans l'application, pour cent
 * millisecondes de bip. Les timbres sont donc décrits ici en clair : c'est aussi ce qui les rend
 * vérifiables sans navigateur.
 */
export type Cue = 'check' | 'uncheck' | 'add' | 'remove' | 'success' | 'error' | 'tap';

export interface Tone {
	/** Fréquence de départ, en hertz. */
	from: number;
	/** Fréquence d'arrivée : un glissement dit « pris » ou « remis » mieux qu'une note tenue. */
	to: number;
	ms: number;
	/** Volume de crête, de 0 à 1. Bas volontairement : ça sert en magasin, à côté de quelqu'un. */
	gain: number;
	wave: 'sine' | 'triangle' | 'square';
}

export type Haptic = 'light' | 'medium' | 'heavy';

/**
 * Aucun son ne dure plus d'un tiers de seconde : au-dessus, cocher dix articles d'affilée
 * transforme la liste en carillon. Les bornes sont tenues par un test.
 */
export const TONE_MAX_MS = 300;
export const TONE_MAX_GAIN = 0.2;

const TONES: Record<Cue, Tone> = {
	check: { from: 660, to: 990, ms: 90, gain: 0.16, wave: 'sine' },
	uncheck: { from: 520, to: 390, ms: 90, gain: 0.1, wave: 'sine' },
	add: { from: 590, to: 780, ms: 110, gain: 0.14, wave: 'triangle' },
	remove: { from: 300, to: 190, ms: 130, gain: 0.12, wave: 'triangle' },
	success: { from: 700, to: 1180, ms: 220, gain: 0.16, wave: 'sine' },
	error: { from: 260, to: 200, ms: 260, gain: 0.18, wave: 'square' },
	tap: { from: 880, to: 880, ms: 40, gain: 0.07, wave: 'sine' }
};

const HAPTICS: Record<Cue, Haptic> = {
	check: 'light',
	uncheck: 'light',
	add: 'light',
	remove: 'medium',
	success: 'medium',
	error: 'heavy',
	tap: 'light'
};

export const CUES = Object.keys(TONES) as Cue[];

export const toneFor = (cue: Cue): Tone => TONES[cue];

export const hapticFor = (cue: Cue): Haptic => HAPTICS[cue];
