/**
 * Redaction de l issue publique ouverte pour un signalement.
 *
 * Tout l interet du fichier tient dans ce qu il n ecrit pas. Le depot est public : la description,
 * la capture, le chemin, l appareil et `user_id` restent en base. L issue ne porte qu un numero,
 * et ce numero ne dit rien a qui n a pas acces a /admin. C est volontaire — l issue est une trace
 * dans le backlog, pas une description ; l administrateur l enrichit a la main au tri, avec les
 * mots qu il choisit, ce qui reste le seul filtre d anonymisation fiable.
 *
 * Le texte produit est en anglais, comme les issues et les pull requests du depot depuis le
 * changement de langue du suivi — et contrairement au courriel de `notify-admins`, qui reste
 * francais parce qu il ne quitte pas la boite de l administrateur.
 *
 * Aucune dependance Deno ici, pour que la mise en forme reste testable par vitest.
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
 * `kind` distingue deja un bug d une suggestion : c est la seule information du signalement qui
 * puisse sortir sans rien dire du foyer, et elle suffit a ranger l issue.
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
