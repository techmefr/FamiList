/**
 * What the database answers when a report is filed.
 *
 * `submit_bug_report` now caps at twenty reports and twelve megabytes of screenshots per account over a
 * rolling twenty-four hours. It does not raise for that: an exception would reach the form as a Postgres
 * message in English, which nobody can translate. It returns an object, and this is where we decide what
 * that becomes on screen.
 *
 * The two caps are said separately because they do not call for the same gesture: too many reports means
 * waiting; too many screenshots means the text alone still goes through, and that is useful to know before
 * giving up.
 *
 * The shape returned by an RPC is not guaranteed on the client side — an updated function, a schema cache
 * lagging behind — so anything we do not recognise falls back on the generic failure rather than on a send
 * we did not obtain.
 */
export type ReportOutcomeKey =
	| 'bugReport.errorTooMany'
	| 'bugReport.errorTooMuchStorage'
	| 'bugReport.errorUnknown';

export type ReportOutcome = { sent: boolean; errorKey: ReportOutcomeKey | null; number: number | null };

export function readReportOutcome(payload: unknown): ReportOutcome {
	if (payload === null || typeof payload !== 'object') {
		return { sent: false, errorKey: 'bugReport.errorUnknown', number: null };
	}

	const answer = payload as { status?: unknown; number?: unknown };

	if (answer.status === 'rate_limited') {
		return { sent: false, errorKey: 'bugReport.errorTooMany', number: null };
	}

	if (answer.status === 'storage_limited') {
		return { sent: false, errorKey: 'bugReport.errorTooMuchStorage', number: null };
	}

	if (answer.status === 'submitted') {
		// The short number is the only reference the person will be able to quote if they write back to us. A
		// send stays a send if it is missing: we do not refuse a filed report because the database failed to
		// tell us its number.
		const number = typeof answer.number === 'number' ? answer.number : null;

		return { sent: true, errorKey: null, number };
	}

	return { sent: false, errorKey: 'bugReport.errorUnknown', number: null };
}
