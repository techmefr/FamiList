/**
 * What the database answers when a crash is filed with it.
 *
 * `report_crash` does not raise: an exception would roll the transaction back, and with it the retention
 * clean-up and the counter increment. It returns an object, like `submit_bug_report` and `redeem_invite`.
 *
 * None of this happens in front of anybody's eyes — an error reporter showing its own failures would be
 * worse than no reporter at all. The only thing read here is whether to stop calling.
 *
 * Anything we do not recognise is treated as a plain failure and not as a cap: an updated function or a
 * schema cache lagging behind must not switch the reporter off for the rest of the session.
 */
export interface CrashOutcome {
	/** The account has used up its quota for the day: no point calling again before the next load. */
	exhausted: boolean;
}

export function readCrashOutcome(payload: unknown): CrashOutcome {
	if (payload === null || typeof payload !== 'object') return { exhausted: false };

	return { exhausted: (payload as { status?: unknown }).status === 'rate_limited' };
}
