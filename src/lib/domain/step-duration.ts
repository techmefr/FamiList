/**
 * How long a recipe step takes (#310): read from its text on import, set by hand in the form, and turned
 * into a timer in cook-along.
 *
 * Detection covers the ten app languages with digits only ("35 min", "1 h 30", "10 à 12 minutes"): words
 * like "une demi-heure" are left to the person, who can type the duration in the form.
 */

/** A day: beyond that it is a marinade to plan, not a timer to watch. */
export const MAX_STEP_SECONDS = 24 * 60 * 60;

const HOURS = 'heures?|hours?|hrs?|horas?|ore|ora|stunden?|std|час(?:а|ов)?|ч|ساعات|ساعة|小时|小時|h';
const MINUTES = 'minutes?|minutos?|minuti|minuto|minuten|minitra|mins?|mn|минут(?:ы|а)?|мин|دقائق|دقيقة|分钟|分鐘|分';
const SECONDS = 'secondes?|seconds?|secs?|segundos?|secondi|secondo|sekunden?|segondra|секунд(?:ы|а)?|сек|ثوان(?:ي)?|ثانية|秒';

/** Words joining the two ends of a range: "10 à 12", "10 to 12", "10 до 12"… */
const RANGE = '-|–|—|~|à|a|to|or|ou|bis|oder|o|y|e|al|até|до|или|إلى|至|到|na';

const NUMBER = '(\\d+(?:[.,]\\d+)?)';

const PATTERN = new RegExp(
	`${NUMBER}(?:\\s*(?:${RANGE})\\s*${NUMBER})?\\s*(?:(?<h>${HOURS})|(?<m>${MINUTES})|(?<s>${SECONDS}))(?!\\p{L})(?:\\s*(?<extra>\\d{1,2})(?![\\d.,]))?`,
	'iu'
);

const ARABIC_INDIC = /[٠-٩]/g;

const toNumber = (text: string) => Number(text.replace(',', '.'));

/** The first duration written in a step, in seconds, or `null`. The upper end of a range is kept. */
export function detectDuration(text: string): number | null {
	const normalized = text.replace(ARABIC_INDIC, (digit) => String(digit.charCodeAt(0) - 0x0660));
	const match = PATTERN.exec(normalized);
	if (!match?.groups) return null;

	const value = toNumber(match[2] ?? match[1]);
	const { h, m, extra } = match.groups;
	const unit = h ? 3600 : m ? 60 : 1;
	// "1 h 30": the number after the hour is minutes. After minutes or seconds, it belongs to the next sentence.
	const trailing = h && extra ? Number(extra) * 60 : 0;

	return clampDuration(Math.round(value * unit + trailing));
}

/** A duration fit to store: a whole number of seconds between 1 and a day, or `null`. */
export function clampDuration(seconds: number | null | undefined): number | null {
	if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;

	return Math.min(Math.round(seconds), MAX_STEP_SECONDS);
}

/** Hours and minutes from the two form fields, either left blank. */
export function durationFromFields(hours: string, minutes: string): number | null {
	const h = Number(hours.trim() || 0);
	const m = Number(minutes.trim() || 0);
	if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) return null;

	return clampDuration(h * 3600 + m * 60);
}

/** The two form fields for a stored duration, blank when there is none. */
export function durationFields(seconds: number | null | undefined): { hours: string; minutes: string } {
	const clamped = clampDuration(seconds);
	if (!clamped) return { hours: '', minutes: '' };

	const { hours, minutes } = splitDuration(clamped);
	return { hours: hours ? String(hours) : '', minutes: minutes ? String(minutes) : '' };
}

export function splitDuration(seconds: number): { hours: number; minutes: number; seconds: number } {
	const whole = Math.max(0, Math.round(seconds));
	return { hours: Math.floor(whole / 3600), minutes: Math.floor((whole % 3600) / 60), seconds: whole % 60 };
}

/** "35:00", "1:05:09": digits read the same in every language, and never jump in width. */
export function formatClock(seconds: number): string {
	const { hours, minutes, seconds: rest } = splitDuration(Math.ceil(seconds));
	const pad = (n: number) => String(n).padStart(2, '0');

	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}

/**
 * The durations the AI returned, one per step in minutes, onto the steps kept after blanks are dropped.
 * A missing or nonsense value falls back on the step's own text.
 */
export function suggestedDurations(raw: unknown, allSteps: string[]): (number | null)[] {
	const given = Array.isArray(raw) ? raw : [];

	return allSteps.flatMap((step, index) => {
		if (!step) return [];
		const minutes = Number(given[index]);

		return [Number.isFinite(minutes) && minutes > 0 ? clampDuration(minutes * 60) : detectDuration(step)];
	});
}
