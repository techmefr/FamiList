/**
 * Ouvre dans le suivi du depot une issue qui ne porte que le numero d un signalement.
 *
 * Reveillee par `public.flush_bug_report_issues()` (pg_cron, chaque minute) : rien ici n est
 * declenche par une action d utilisateur, et rien ici ne peut donc faire echouer un signalement ou
 * bloquer l ecran d administration. La fonction repond toujours 200 — une erreur renvoyee ne
 * serait lue par personne, alors qu une ligne relachee sera reprise au tour suivant.
 *
 * Le jeton vit ici et nulle part ailleurs. Un jeton d ecriture sur un depot ne peut pas partir
 * dans le bundle client : le bundle est publie, le jeton le serait avec lui.
 *
 * Secrets attendus (`supabase secrets set`) : ISSUE_TRACKER_TOKEN, le jeton a portee minimale
 * (issues: write sur ce seul depot), et ISSUE_TRACKER_REPO au format `proprietaire/depot`.
 * ISSUE_TRACKER_API n est utile que pour une forge auto-hebergee. Tant qu ils manquent, la
 * fonction relache ce qu elle a reclame et rien n est publie.
 */

import { type ReportToPublish, buildIssue } from './issue.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
	const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			apikey: SERVICE_KEY,
			Authorization: `Bearer ${SERVICE_KEY}`
		},
		body: JSON.stringify(args)
	});

	if (!response.ok) {
		throw new Error(`${name}: ${response.status} ${await response.text()}`);
	}

	// Une fonction `returns void` repond 204 sans corps : `response.json()` echouerait dessus.
	const body = await response.text();

	return (body === '' ? null : JSON.parse(body)) as T;
}

async function openIssue(report: ReportToPublish): Promise<{ number: number; url: string }> {
	const token = Deno.env.get('ISSUE_TRACKER_TOKEN');
	const repo = Deno.env.get('ISSUE_TRACKER_REPO');
	if (!token || !repo) throw new Error('suivi du depot non configure');

	const api = Deno.env.get('ISSUE_TRACKER_API') ?? 'https://api.github.com';

	const response = await fetch(`${api}/repos/${repo}/issues`, {
		method: 'POST',
		headers: {
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			// L API refuse une requete sans agent, et le nom sert a se reconnaitre dans les journaux
			// du depot le jour ou une issue arrive sans qu on comprenne d ou.
			'User-Agent': 'familiste-publish-report-issues',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify(buildIssue(report))
	});

	if (!response.ok) {
		throw new Error(`issues: ${response.status} ${await response.text()}`);
	}

	const created = (await response.json()) as { number: number; html_url: string };

	return { number: created.number, url: created.html_url };
}

Deno.serve(async () => {
	let claimed: string[] = [];

	try {
		const reports = await rpc<ReportToPublish[]>('claim_bug_report_issues', {});
		if (reports.length === 0) {
			return Response.json({ status: 'nothing_to_publish' });
		}

		claimed = reports.map((report) => report.id);

		let published = 0;

		for (const report of reports) {
			const issue = await openIssue(report);

			// Marquee une par une, et non en une fois a la fin : une coupure au milieu du lot ne doit
			// pas faire rouvrir demain les issues deja creees. `mark_bug_report_issue` n ecrit que
			// sur une ligne encore sans numero, un doublon reste donc sans effet.
			await rpc('mark_bug_report_issue', {
				target: report.id,
				issue_number: issue.number,
				issue_url: issue.url
			});

			claimed = claimed.filter((id) => id !== report.id);
			published += 1;
		}

		return Response.json({ status: 'published', issues: published });
	} catch (error) {
		if (claimed.length > 0) {
			// Relachees et non perdues : le prochain reveil les reprendra, et la demande reste visible
			// dans /admin en attendant.
			await rpc('release_bug_report_issues', { ids: claimed }).catch(() => undefined);
		}

		console.error('publish-report-issues', error);

		return Response.json({ status: 'failed', error: String(error) });
	}
});
