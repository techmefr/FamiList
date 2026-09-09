/** Un signalement décrit soit un dysfonctionnement, soit une idée d'amélioration. */
export const REPORT_KINDS = ['bug', 'suggestion'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export function isReportKind(value: unknown): value is ReportKind {
	return typeof value === 'string' && (REPORT_KINDS as readonly string[]).includes(value);
}
