create or replace function public.clear_resolved_bug_report_screenshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'resolved' then
    new.screenshot := null;
  end if;

  return new;
end;
$$;

revoke all on function public.clear_resolved_bug_report_screenshot() from public, anon, authenticated;

drop trigger if exists bug_reports_clear_screenshot on public.bug_reports;

create trigger bug_reports_clear_screenshot
before insert or update on public.bug_reports
for each row
execute function public.clear_resolved_bug_report_screenshot();

update public.bug_reports set screenshot = null where status = 'resolved' and screenshot is not null;

create or replace function public.purge_diagnostics()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.bug_reports
  where status = 'resolved'
    and coalesce(resolved_at, created_at) < now() - interval '3 months';

  delete from public.bug_reports
  where status = 'open'
    and created_at < now() - interval '6 months';

  delete from public.client_errors
  where last_seen_at < now() - interval '3 months';
end;
$$;

revoke all on function public.purge_diagnostics() from public, anon, authenticated;

alter table public.bug_reports drop constraint if exists bug_reports_user_id_fkey;
alter table public.bug_reports
  add constraint bug_reports_user_id_fkey foreign key (user_id) references auth.users on delete cascade;

alter table public.client_errors drop constraint if exists client_errors_user_id_fkey;
alter table public.client_errors
  add constraint client_errors_user_id_fkey foreign key (user_id) references auth.users on delete cascade;

create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('familist-purge-diagnostics')
  where exists (select 1 from cron.job where jobname = 'familist-purge-diagnostics');

  perform cron.schedule(
    'familist-purge-diagnostics',
    '17 3 * * *',
    $cron$select public.purge_diagnostics()$cron$
  );
end;
$$;
