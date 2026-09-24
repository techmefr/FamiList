import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
	join(process.cwd(), 'supabase/migrations/20260924170000_bug_report_retention.sql'),
	'utf8'
);

describe('diagnostics retention migration', () => {
	it('clears the screenshot of a resolved report', () => {
		expect(sql).toMatch(/create trigger bug_reports_clear_screenshot[\s\S]*on public\.bug_reports/);
		expect(sql).toContain('new.screenshot := null');
	});

	it('purges reports and client errors after the announced periods', () => {
		expect(sql).toContain('create or replace function public.purge_diagnostics()');
		expect(sql).toMatch(/status = 'resolved'[\s\S]*interval '3 months'/);
		expect(sql).toMatch(/status = 'open'[\s\S]*interval '6 months'/);
		expect(sql).toMatch(/delete from public\.client_errors[\s\S]*interval '3 months'/);
	});

	it('runs the purge daily and idempotently', () => {
		expect(sql).toContain('create extension if not exists pg_cron');
		expect(sql).toMatch(/cron\.unschedule\('familist-purge-diagnostics'\)/);
		expect(sql).toMatch(/cron\.schedule\(\s*'familist-purge-diagnostics',\s*'17 3 \* \* \*'/);
	});

	it('deletes diagnostics with the account', () => {
		expect(sql).toMatch(/bug_reports_user_id_fkey[\s\S]*on delete cascade/);
		expect(sql).toMatch(/client_errors_user_id_fkey[\s\S]*on delete cascade/);
	});

	it('pins the search path of its security definer functions', () => {
		expect(sql.match(/security definer/g)?.length).toBe(sql.match(/set search_path = ''/g)?.length);
	});
});
