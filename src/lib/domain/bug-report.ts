/** A report describes either a malfunction or an idea for an improvement. */
export const REPORT_KINDS = ['bug', 'suggestion'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export function isReportKind(value: unknown): value is ReportKind {
	return typeof value === 'string' && (REPORT_KINDS as readonly string[]).includes(value);
}
