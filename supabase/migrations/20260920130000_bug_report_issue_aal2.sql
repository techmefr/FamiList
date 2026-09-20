-- `request_bug_report_issue` was added after `assert_admin_write()` (20260915100000) but kept the older
-- bare `is_admin()` check instead of using it, unlike its sibling `resolve_bug_report` in the same file.
-- An admin session that has not cleared its second factor could still trigger a GitHub issue request
-- through it, even though every other admin write is blocked until aal2.
create or replace function public.request_bug_report_issue(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  update public.bug_reports
  set issue_requested_at = now()
  where id = target
    and issue_number is null
    and issue_requested_at is null;
end;
$$;

revoke all on function public.request_bug_report_issue(uuid) from public;
grant execute on function public.request_bug_report_issue(uuid) to authenticated;
