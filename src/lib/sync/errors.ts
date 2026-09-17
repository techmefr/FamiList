/**
 * What we keep of an outage in order to show it.
 *
 * The sync's detached paths catch whatever comes, and what comes is not always an `Error`: Dexie and the
 * Supabase client sometimes reject a bare object or a string, and a misplaced `throw` can even reject
 * `undefined`. The banner must say something in every case — "[object Object]" or an empty box tells nobody
 * anything.
 */
export function describeError(cause: unknown): string {
	if (cause instanceof Error) return cause.message || cause.name;
	if (typeof cause === 'string') return cause;

	if (cause && typeof cause === 'object' && 'message' in cause) {
		const message = (cause as { message: unknown }).message;
		if (typeof message === 'string' && message) return message;
	}

	return 'erreur inconnue';
}
