import { MAX_STEP_SECONDS } from './step-duration';

/**
 * A cook-along timer (#310). Kept by end time rather than by a countdown, so it stays right across a
 * reload, a locked phone or cook-along closed and reopened.
 */
export interface Timer {
	id: string;
	recipeId: string;
	recipeName: string;
	stepIndex: number;
	/** The step's text, shortened: "oven" and "sauce" must be told apart at a glance. */
	label: string;
	durationSeconds: number;
	endsAt: number;
}

/** A timer that rang this long ago without anyone stopping it is dropped rather than rung again. */
export const STALE_AFTER_MS = 60 * 60 * 1000;

const LABEL_LENGTH = 48;

export function timerLabel(step: string): string {
	const text = step.trim().replace(/\s+/g, ' ');
	return text.length <= LABEL_LENGTH ? text : `${text.slice(0, LABEL_LENGTH - 1).trimEnd()}…`;
}

export function remainingSeconds(timer: Pick<Timer, 'endsAt'>, now: number): number {
	return Math.max(0, (timer.endsAt - now) / 1000);
}

export function isRinging(timer: Pick<Timer, 'endsAt'>, now: number): boolean {
	return timer.endsAt <= now;
}

/** "+1 min": from the end still ahead, or from now for a timer already ringing. */
export function extendedEnd(timer: Pick<Timer, 'endsAt'>, now: number, seconds = 60): number {
	return Math.max(timer.endsAt, now) + seconds * 1000;
}

/** Timers read back from storage: anything malformed or long forgotten is left out. */
export function parseStoredTimers(raw: unknown, now: number): Timer[] {
	if (!Array.isArray(raw)) return [];

	return raw.flatMap((entry): Timer[] => {
		if (typeof entry !== 'object' || entry === null) return [];
		const t = entry as Record<string, unknown>;

		const valid =
			typeof t.id === 'string' &&
			typeof t.recipeId === 'string' &&
			typeof t.recipeName === 'string' &&
			typeof t.label === 'string' &&
			Number.isInteger(t.stepIndex) &&
			typeof t.durationSeconds === 'number' &&
			t.durationSeconds > 0 &&
			t.durationSeconds <= MAX_STEP_SECONDS &&
			typeof t.endsAt === 'number' &&
			Number.isFinite(t.endsAt);
		if (!valid || now - (t.endsAt as number) > STALE_AFTER_MS) return [];

		return [
			{
				id: t.id as string,
				recipeId: t.recipeId as string,
				recipeName: t.recipeName as string,
				stepIndex: t.stepIndex as number,
				label: t.label as string,
				durationSeconds: t.durationSeconds as number,
				endsAt: t.endsAt as number
			}
		];
	});
}
