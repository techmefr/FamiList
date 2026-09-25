import { browser } from '$app/environment';
import { t } from '$i18n/index.svelte';
import { clampDuration } from '$domain/step-duration';
import { extendedEnd, isRinging, parseStoredTimers, remainingSeconds, timerLabel, type Timer } from '$domain/timers';
import { cancelTimerAlarm, scheduleTimerAlarm } from '$native/timer-alarm';
import { feedback } from './feedback.svelte';

const STORAGE_KEY = 'familist:timers';
/** The alarm plays again at this pace until someone stops it, and gives up after a few minutes. */
const ALARM_EVERY_MS = 1200;
const ALARM_FOR_MS = 5 * 60 * 1000;

/**
 * Every running cook-along timer, across recipes (#310). Several at once is the point: the oven and the
 * sauce. They outlive cook-along and a reload; the ringing one is shown app-wide by `TimerAlarm`.
 */
class Timers {
	list = $state<Timer[]>([]);
	now = $state(Date.now());

	#tick: ReturnType<typeof setInterval> | null = null;
	#alarmSince: number | null = null;
	#lastAlarm = 0;

	constructor() {
		if (!browser) return;

		try {
			this.list = parseStoredTimers(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'), Date.now());
		} catch {
			this.list = [];
		}
		this.#sync();
	}

	get ringing(): Timer[] {
		return this.list.filter((timer) => isRinging(timer, this.now));
	}

	remaining(timer: Timer): number {
		return remainingSeconds(timer, this.now);
	}

	ofRecipe(recipeId: string): Timer[] {
		return this.list.filter((timer) => timer.recipeId === recipeId);
	}

	forStep(recipeId: string, stepIndex: number): Timer | undefined {
		return this.list.find((timer) => timer.recipeId === recipeId && timer.stepIndex === stepIndex);
	}

	start(input: { recipeId: string; recipeName: string; stepIndex: number; step: string; seconds: number }) {
		const durationSeconds = clampDuration(input.seconds);
		if (!durationSeconds) return;

		const existing = this.forStep(input.recipeId, input.stepIndex);
		if (existing) this.stop(existing.id);

		const timer: Timer = {
			id: crypto.randomUUID(),
			recipeId: input.recipeId,
			recipeName: input.recipeName,
			stepIndex: input.stepIndex,
			label: timerLabel(input.step),
			durationSeconds,
			endsAt: Date.now() + durationSeconds * 1000
		};

		this.list = [...this.list, timer];
		this.#changed();
		void this.#schedule(timer);
	}

	stop(id: string) {
		this.list = this.list.filter((timer) => timer.id !== id);
		this.#changed();
		void cancelTimerAlarm(id);
	}

	addMinute(id: string) {
		this.now = Date.now();
		this.list = this.list.map((timer) => (timer.id === id ? { ...timer, endsAt: extendedEnd(timer, this.now) } : timer));
		this.#changed();

		const timer = this.list.find((candidate) => candidate.id === id);
		if (timer) void cancelTimerAlarm(id).then(() => this.#schedule(timer));
	}

	#schedule(timer: Timer) {
		return scheduleTimerAlarm(
			timer,
			t('timers.doneTitle'),
			t('timers.doneBody', { recipe: timer.recipeName, step: timer.label })
		);
	}

	#changed() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.list));
		} catch {
			// Private window: the timers still run, they just will not survive a reload.
		}
		this.#sync();
	}

	#sync() {
		if (this.list.length === 0) {
			if (this.#tick) clearInterval(this.#tick);
			this.#tick = null;
			this.#alarmSince = null;
			return;
		}

		this.#tick ??= setInterval(() => {
			this.now = Date.now();
			this.#ring();
		}, 250);
	}

	#ring() {
		if (this.ringing.length === 0) {
			this.#alarmSince = null;
			return;
		}

		this.#alarmSince ??= this.now;
		if (this.now - this.#alarmSince > ALARM_FOR_MS) return;
		if (this.now - this.#lastAlarm < ALARM_EVERY_MS) return;

		this.#lastAlarm = this.now;
		feedback.play('alarm');
	}
}

export const timers = new Timers();
