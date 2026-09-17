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
 * Configuration : les reglages d instance poses depuis `/admin` (#138), avec priorite aux secrets
 * de fonction quand ils existent — ISSUE_TRACKER_TOKEN, le jeton a portee minimale (issues: write
 * sur ce seul depot), et ISSUE_TRACKER_REPO au format `proprietaire/depot`. ISSUE_TRACKER_API n est
 * utile que pour une forge auto-hebergee. Tant que ni l un ni l autre ne repond, la fonction
 * relache ce qu elle a reclame et rien n est publie.
 */

import { callRpc, serviceKey } from '../_shared/rpc.ts';
import { type InstanceConfig, resolveSettings } from '../_shared/settings.ts';
import { type ReportToPublish, buildIssue } from './issue.ts';

const TRACKER_KEYS = ['issue_tracker_token', 'issue_tracker_repo', 'issue_tracker_api'] as const;

const rpc = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
	callRpc<T>(name, args, serviceKey());

async function loadTrackerSettings(): Promise<Record<string, string | undefined>> {
	let stored: InstanceConfig = {};

	try {
		stored = (await rpc<InstanceConfig>('instance_config', {})) ?? {};
	} catch (error) {
		// Une fonction deployee en avance sur la base ne doit pas cesser de publier : on retombe sur
		// l environnement seul, qui etait tout ce qui existait avant cette migration.
		console.warn('instance_config indisponible', error);
	}

	return resolveSettings(TRACKER_KEYS, Deno.env.toObject(), stored);
}

async function openIssue(
	report: ReportToPublish,
	settings: Record<string, string | undefined>
): Promise<{ number: number; url: string }> {
	const token = settings.issue_tracker_token;
	const repo = settings.issue_tracker_repo;
	if (!token || !repo) throw new Error('suivi du depot non configure');

	const api = settings.issue_tracker_api ?? 'https://api.github.com';

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

		const settings = await loadTrackerSettings();

		let published = 0;

		for (const report of reports) {
			const issue = await openIssue(report, settings);

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
