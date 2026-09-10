/**
 * Ce qu'on retient d'une panne pour l'afficher.
 *
 * Les chemins détachés de la synchronisation attrapent tout ce qui passe, et ce qui passe n'est
 * pas toujours une `Error` : Dexie et le client Supabase rejettent parfois un objet nu, une
 * chaîne, et un `throw` mal placé peut même rejeter `undefined`. Le bandeau doit dire quelque
 * chose dans tous les cas — « [object Object] » ou une case vide ne renseignent personne.
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
