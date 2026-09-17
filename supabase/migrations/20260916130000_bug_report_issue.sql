-- A report carries a short number, and can be published in the repository's tracker.
--
-- Two gaps answer each other. On one side `bug_reports.id` is a uuid: it is not read, not said over the
-- phone, not put in a title. On the other side the reports exist only in /admin, while the work itself is
-- tracked in the repository's issues.
--
-- What the issue contains, and above all what it does not contain.
--
-- The repository is public. `description` runs to four thousand characters of free text where somebody may
-- write their name or a relative's; `screenshot` up to one and a half megabytes of JPEG showing the
-- household's real lists, the members' first names and their avatars; `path` may carry a list's identifier
-- and `user_agent` a device fingerprint. Copying all that would require an anonymisation filter, and no
-- automatic filter catches a first name written in the middle of a sentence. So the issue carries only a
-- number: "Report 42 — to be handled in /admin". There is nothing left to anonymise, because there is
-- nothing left going out. The content stays in the database, behind the administration screen.
--
-- Publication is requested by hand from /admin, never automatically.
--
-- Automatic, the tracker would reflect reality with no effort — but every approved account could then write
-- into a public repository. The cap set by migration 20260913110000 bounds this at twenty reports per day
-- per account: that is twenty public issues per day per account, and the repository has no way of removing
-- them. An issue saying only a number is in any case actionable only by an administrator, who has already
-- been told by the email of migration 20260914100000: publishing it automatically would teach them nothing
-- they do not know. It serves as a trace in the backlog, and it is while triaging that we decide whether a
-- report deserves that trace.
--
-- The call path reuses `notify-admins`'s, without inventing a second one: the GitHub token is a write token,
-- and it cannot travel in a client bundle. The administrator files a request (a simple local update, which
-- cannot fail on a GitHub outage), pg_cron wakes the edge function every minute through pg_net, and the edge
-- function calls the database back with the issue number obtained. With no Vault secrets — which is the case
-- in CI and on a fresh database — the wake-up posts nothing and writes no error: `db reset` passes without a
-- single credential.
--
-- The number is carried by a sequence and not by a `count(*)`: two simultaneous reports would get the same
-- number, and a deleted report would shift all the following ones. A sequence never goes back, even if the
-- transaction that consumed it is rolled back — a gap in the run costs less than a number reassigned to
-- another report.
create sequence public.bug_report_number_seq;

alter table public.bug_reports
  add column number bigint,
  add column issue_number integer,
  add column issue_url text,
  add column issue_requested_at timestamptz,
  add column issue_claimed_at timestamptz,
  add column issue_published_at timestamptz;

-- The reports already filed are numbered in their order of arrival, so that the number says something on a
-- chronological reading and is not an order for rewriting the table.
with ordonnes as (
  select id, row_number() over (order by created_at, id) as rang
  from public.bug_reports
)
update public.bug_reports r
set number = o.rang
from ordonnes o
where o.id = r.id;

select setval(
  'public.bug_report_number_seq',
  coalesce((select max(number) from public.bug_reports), 0) + 1,
  false
);

alter table public.bug_reports
  alter column number set default nextval('public.bug_report_number_seq'),
  alter column number set not null,
  add constraint bug_reports_number_key unique (number);

alter sequence public.bug_report_number_seq owned by public.bug_reports.number;

create index bug_reports_issue_pending_idx
  on public.bug_reports (issue_requested_at)
  where issue_requested_at is not null and issue_number is null;

comment on column public.bug_reports.number is
  'Numero court et stable, dit a la personne qui signale et repris dans le titre de l issue publique.';
comment on column public.bug_reports.issue_number is
  'Numero de l issue ouverte dans le suivi du depot. Non nul, le signalement ne sera pas republie.';
comment on column public.bug_reports.issue_requested_at is
  'Pose par un administrateur depuis /admin. Une demande en attente est reprise a chaque reveil du cron.';

-- The number goes back to the person who has just reported: it is the only reference they will be able to
-- quote if they write back to us, and they have access to nothing else of their own row.
create or replace function public.submit_bug_report(
  description text,
  screenshot text,
  path text,
  user_agent text,
  kind text default 'bug'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_id uuid;
  inserted_number bigint;
  recent_count integer;
  recent_bytes bigint;
begin
  if not public.is_approved() then
    raise exception 'reserve aux comptes approuves' using errcode = '42501';
  end if;

  if kind not in ('bug', 'suggestion') then
    raise exception 'type de signalement invalide: %', kind using errcode = '22023';
  end if;

  select count(*), coalesce(sum(char_length(r.screenshot)), 0)
  into recent_count, recent_bytes
  from public.bug_reports r
  where r.user_id = (select auth.uid())
    and r.created_at > now() - interval '24 hours';

  if recent_count >= 20 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  if nullif(screenshot, '') is not null
    and recent_bytes + char_length(screenshot) > 12000000
  then
    return jsonb_build_object('status', 'storage_limited');
  end if;

  -- The alias stops `number` from the RETURNING being read as a variable of the block rather than as the
  -- column: the table is named `inserted` there, and the column is qualified.
  insert into public.bug_reports as inserted
    (user_id, description, screenshot, path, user_agent, kind)
  values ((select auth.uid()), description, nullif(screenshot, ''), nullif(path, ''), user_agent, kind)
  returning inserted.id, inserted.number into inserted_id, inserted_number;

  return jsonb_build_object('status', 'submitted', 'id', inserted_id, 'number', inserted_number);
end;
$$;

comment on function public.submit_bug_report(text, text, text, text, text) is
  'Depose un signalement sous deux plafonds par compte sur vingt-quatre heures glissantes : vingt signalements et douze megaoctets de captures. Renvoie un objet decrivant l issue, numero court compris, plutot que de lever.';

-- Return type changed (columns added): create or replace refuses it.
drop function if exists public.list_bug_reports();

create or replace function public.list_bug_reports()
returns table (
  id uuid,
  number bigint,
  email text,
  description text,
  screenshot text,
  path text,
  user_agent text,
  kind text,
  status text,
  created_at timestamptz,
  issue_number integer,
  issue_url text,
  issue_requested_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.number, u.email::text, r.description, r.screenshot, r.path, r.user_agent,
         r.kind, r.status, r.created_at, r.issue_number, r.issue_url, r.issue_requested_at
  from public.bug_reports r
  left join auth.users u on u.id = r.user_id
  where public.is_admin()
  order by r.created_at desc
$$;

revoke all on function public.list_bug_reports() from public;
grant execute on function public.list_bug_reports() to authenticated;

-- The request only does a local update. Nothing here speaks to GitHub: an unreachable repository must let
-- the button answer, and the request will be taken again at the next wake-up.
create or replace function public.request_bug_report_issue(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'reserve aux administrateurs' using errcode = '42501';
  end if;

  update public.bug_reports
  set issue_requested_at = now()
  where id = target
    and issue_number is null
    and issue_requested_at is null;
end;
$$;

revoke all on function public.request_bug_report_issue(uuid) from public;
grant execute on function public.request_bug_report_issue(uuid) to authenticated;

-- What the edge function receives: a number and a kind, nothing else. The day somebody got the destination
-- wrong, there would still be nothing to read in it.
create or replace function public.claim_bug_report_issues()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with picked as (
    update public.bug_reports r
    set issue_claimed_at = now()
    where r.id in (
      select c.id
      from public.bug_reports c
      where c.issue_requested_at is not null
        and c.issue_number is null
        and (c.issue_claimed_at is null or c.issue_claimed_at < now() - interval '5 minutes')
      order by c.issue_requested_at
      limit 20
      for update skip locked
    )
    returning r.id, r.number, r.kind, r.issue_requested_at
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', p.id, 'number', p.number, 'kind', p.kind)
      order by p.issue_requested_at
    ),
    '[]'::jsonb
  )
  from picked p;
$$;

create or replace function public.mark_bug_report_issue(
  target uuid,
  issue_number integer,
  issue_url text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.bug_reports r
  set issue_number = mark_bug_report_issue.issue_number,
      issue_url = mark_bug_report_issue.issue_url,
      issue_published_at = now(),
      issue_claimed_at = null
  where r.id = target and r.issue_number is null;
$$;

create or replace function public.release_bug_report_issues(ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.bug_reports
  set issue_claimed_at = null
  where id = any(ids) and issue_number is null;
$$;

revoke all on function public.claim_bug_report_issues() from public, anon, authenticated;
revoke all on function public.mark_bug_report_issue(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.release_bug_report_issues(uuid[]) from public, anon, authenticated;
grant execute on function public.claim_bug_report_issues() to service_role;
grant execute on function public.mark_bug_report_issue(uuid, integer, text) to service_role;
grant execute on function public.release_bug_report_issues(uuid[]) to service_role;

create or replace function public.flush_bug_report_issues()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  functions_url text;
  service_key text;
begin
  if not exists (
    select 1 from public.bug_reports
    where issue_requested_at is not null and issue_number is null
  ) then
    return;
  end if;

  -- The same two secrets as `notify-admins`'s wake-up: they name the project's functions URL and its service
  -- key, not a particular use. Asking for a copy of them under another name would only add one more place to
  -- get wrong.
  select s.decrypted_secret into functions_url
  from vault.decrypted_secrets s
  where s.name = 'admin_notifications_functions_url';

  select s.decrypted_secret into service_key
  from vault.decrypted_secrets s
  where s.name = 'admin_notifications_service_key';

  if functions_url is null or service_key is null then
    return;
  end if;

  perform net.http_post(
    url := functions_url || '/publish-report-issues',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.flush_bug_report_issues() from public, anon, authenticated;

comment on function public.flush_bug_report_issues() is
  'Reveille l Edge Function publish-report-issues s il reste une demande de publication et si les secrets Vault sont poses. Ne leve jamais et ne parle a personne elle-meme.';

-- Every minute, and not every five like the email: here somebody has just clicked and is watching the
-- screen. The work is nil while no request is waiting, the request only leaving behind the `exists` above.
do $$
begin
  perform cron.unschedule('familist-bug-report-issues')
  where exists (select 1 from cron.job where jobname = 'familist-bug-report-issues');

  perform cron.schedule(
    'familist-bug-report-issues',
    '* * * * *',
    $cron$select public.flush_bug_report_issues()$cron$
  );
end;
$$;
