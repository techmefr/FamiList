/**
 * Writing the public issue opened for a report.
 *
 * The whole point of the file is in what it does not write. The repository is public: the description, the
 * capture, the path, the device and `user_id` stay in the database. The issue carries only a number, and
 * that number says nothing to whoever has no access to /admin. That is intended — the issue is a trace in
 * the backlog, not a description; the administrator enriches it by hand while triaging, with the words they
 * choose, which remains the only reliable anonymisation filter.
 *
 * The text produced is in English, like the repository's issues and pull requests since the tracker changed
 * language — and unlike the `notify-admins` email, which stays French because it does not leave the
 * administrator's inbox.
 *
 * No Deno dependency here, so that the formatting stays testable by vitest.
 */

export type ReportToPublish = {
	id: string;
	number: number;
	kind: string;
};

export type IssuePayload = {
	title: string;
	body: string;
	labels: string[];
};

/**
 * `kind` already tells a bug from a suggestion: it is the only piece of information from the report that can
 * leave without saying anything about the household, and it is enough to file the issue.
 */
const LABELS: Record<string, string> = {
	bug: 'bug',
	suggestion: 'enhancement'
};

export function buildIssue(report: ReportToPublish): IssuePayload {
	const noun = report.kind === 'suggestion' ? 'Suggestion' : 'Report';

	return {
		title: `${noun} ${report.number} — triage in /admin`,
		body: [
			`${noun} ${report.number}.`,
			'',
			'The content stays in the database, behind /admin: it carries free text, a screenshot of',
			'the household lists and the path the report was filed from, none of which can be public.'
		].join('\n'),
		labels: [LABELS[report.kind] ?? 'bug']
	};
}
