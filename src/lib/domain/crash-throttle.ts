/**
 * What decides that a crash is worth a network call.
 *
 * A failing render loop does not throw once: it throws on every frame, hundreds of times a second. The
 * database already knows how to defend itself — it does not rewrite the same fingerprint twice in thirty
 * seconds — but it only defends itself after receiving the call. A device in a loop would then send
 * hundreds of requests a second from a browser already in difficulty, which is exactly the moment not to
 * ask anything more of it.
 *
 * Hence this filter, in memory, before the network. It is deliberately pure and clockless: time is passed
 * to it, which makes it testable without waiting.
 *
 * It does not survive a page reload, and that is intended. Persisting it would mean writing to local
 * storage from a crash path, that is, adding a write that can itself fail where nothing must fail.
 */

/** Two occurrences of the same fingerprint sent at most once a minute. */
export const CRASH_REPEAT_DELAY_MS = 60_000;

/**
 * Cap on sends over the life of the tab. Twenty distinct crashes is already an unusable session: beyond
 * that, we learn nothing more and only add noise.
 */
export const CRASH_SESSION_LIMIT = 20;

export class CrashThrottle {
	#lastSent = new Map<string, number>();
	#sent = 0;
	#stopped = false;

	/**
	 * True if this crash must go now. A call answering true counts as sent: the caller does not have to
	 * report it afterwards, and an error path with two steps not to forget is an error path you forget.
	 */
	allow(fingerprint: string, now: number): boolean {
		if (this.#stopped) return false;

		const previous = this.#lastSent.get(fingerprint);
		if (previous !== undefined && now - previous < CRASH_REPEAT_DELAY_MS) return false;

		if (this.#sent >= CRASH_SESSION_LIMIT) return false;

		this.#lastSent.set(fingerprint, now);
		this.#sent += 1;
		return true;
	}

	/**
	 * Stops everything until the next load.
	 *
	 * Called when the database answers that a daily cap is reached: going on calling a function that has
	 * already said no is pure noise, and that device clearly has something else to deal with.
	 */
	stop() {
		this.#stopped = true;
	}

	get stopped() {
		return this.#stopped;
	}
}
