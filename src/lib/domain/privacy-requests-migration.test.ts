import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRIVACY_REQUEST_KINDS } from './privacy-request';

const sql = readFileSync(
	join(process.cwd(), 'supabase/migrations/20260924180000_privacy_requests.sql'),
	'utf8'
);

describe('privacy requests migration', () => {
	it('creates the table with row level security and no direct access', () => {
		expect(sql).toContain('create table public.privacy_requests');
		expect(sql).toMatch(/user_id uuid references auth\.users on delete set null/);
		expect(sql).toContain('alter table public.privacy_requests enable row level security');
		expect(sql).toContain('revoke all on public.privacy_requests from public, anon, authenticated');
	});

	it('accepts exactly the kinds the form offers', () => {
		for (const kind of PRIVACY_REQUEST_KINDS) expect(sql).toContain(`'${kind}'`);
	});

	it('lets anyone submit under a per-email cap', () => {
		expect(sql).toContain('create or replace function public.submit_privacy_request');
		expect(sql).toContain(
			'grant execute on function public.submit_privacy_request(text, text, text) to anon, authenticated'
		);
		expect(sql).toMatch(/recent_for_email >= 3/);
		expect(sql).toMatch(/interval '24 hours'/);
	});

	it('keeps reads and writes for administrators', () => {
		expect(sql).toMatch(/list_privacy_requests[\s\S]*where public\.is_admin\(\)/);
		expect(sql).toMatch(/close_privacy_request[\s\S]*perform public\.assert_admin_write\(\)/);
	});

	it('notifies the administrators through the existing queue', () => {
		expect(sql).toContain("check (kind in ('signup', 'bug_report', 'approved', 'privacy_request'))");
		expect(sql).toContain('create trigger privacy_requests_notify_admins');
	});

	it('purges closed requests three years after closing', () => {
		expect(sql).toMatch(
			/delete from public\.privacy_requests[\s\S]*closed_at < now\(\) - interval '3 years'/
		);
	});

	it('pins the search path of its security definer functions', () => {
		expect(sql.match(/security definer/g)?.length).toBe(sql.match(/set search_path = ''/g)?.length);
	});
});
