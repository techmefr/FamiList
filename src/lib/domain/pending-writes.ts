/**
 * Counts Dexie writes started but not yet settled.
 *
 * A mutator in the data store updates the in-memory cache synchronously, then writes to Dexie without
 * awaiting it — the screen must not wait on disk. Meanwhile `hydrate()` re-reads a whole table from Dexie
 * on every sync round-trip and replaces the cache wholesale. If that read lands before a write above has
 * settled, it misses the still-in-flight row and the wholesale replacement clobbers the optimistic entry.
 *
 * `track` lets a caller wrap such a write so `count` reports whether one is still on the way; `hydrate()`
 * checks it before replacing a cache it could otherwise clobber.
 */
export class PendingWrites {
	#count = 0;

	get count(): number {
		return this.#count;
	}

	async track<T>(write: Promise<T>): Promise<T> {
		this.#count++;
		try {
			return await write;
		} finally {
			this.#count--;
		}
	}
}
