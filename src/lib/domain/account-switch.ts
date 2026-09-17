/**
 * What to do with an identity the server has just returned, when the local cache is already on screen.
 *
 * `getUser()` questions the server: a network outage answers with an error, not with an absent account.
 * Confusing the two would make a passing outage look like an account change, and would empty the offline
 * cache of somebody who is in fact still signed in.
 */
export type AccountDecision = 'ignore' | 'remember' | 'reload';

export type KnownAccount = { id: string; known: boolean };
export type AccountAnswer = { id: string; failed: boolean };

export function accountDecision(previous: KnownAccount, answer: AccountAnswer): AccountDecision {
	if (answer.failed) return 'ignore';

	// First start-up with no network: we learn the identity on the first success, without emptying anything.
	// The cache is this account's, nobody has changed.
	if (!previous.known) return 'remember';

	return answer.id === previous.id ? 'ignore' : 'reload';
}
