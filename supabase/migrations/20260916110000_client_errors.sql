-- A silent crash now leaves a trace, and it stays at home.
--
-- The only bug signal today is deliberate: somebody opens the report panel and writes. An uncaught
-- JavaScript error, for its part, reaches nowhere — the screen freezes, the person closes the application,
-- and the bug survives for months.
--
-- WHY NOT SENTRY, NOR ANY THIRD-PARTY SERVICE. A stack trace carries route paths, error messages written by
-- our own functions, sometimes the name of a list inside a constraint refusal. Sending that to an outside
-- vendor would amount to entrusting them, continuously and without anybody having asked, with fragments of
-- the domestic life of whole families. This repository has already refused reverse geocoding for that exact
-- reason (see shop_place): we do not take data out of the house because it is convenient. And there is
-- nothing to gain here — the project already has a Postgres, an administration panel, a reports table and a
-- proven RLS discipline. A third-party service would bring a dashboard and a data-processing contract; the
-- table below brings the dashboard without the contract.
--
-- WHAT IS STORED, AND WHAT CANNOT BE. The client cleans before sending: email addresses, UUID identifiers,
-- query strings, tokens, personal file paths and long runs of digits are replaced by markers (see
-- src/lib/domain/crash.ts). What CANNOT be cleaned, and it has to be said plainly: the free text of an
-- `Error`. A library — or our own code — may have copied the name of a list, a shop or an item into it. No
-- regular-expression rule tells "Granny's picnic" from a technical word. Hence the 500-character cap on the
-- message, the short retention, and the fact that the administration screen NEVER shows who crashed: only
-- how many accounts. A report is voluntary, and its author accepts being named; a crash is not.
--
-- DEDUPLICATION. A loop raising the same error five hundred times must not write five hundred rows. The
-- client computes a stable fingerprint (source, normalised message, first stack frame without line number)
-- and the database upserts on (account, fingerprint): one row per distinct error and per account, with a
-- counter. Per account and not globally, so that "how many people are affected" stays readable without ever
-- storing who.
--
-- A resolved error that reappears reopens its row. Without that, a bug filed away too quickly would become
-- invisible again even as it goes on breaking screens every day.
--
-- VOLUME. Two caps on the same rolling twenty-four-hour window, as for the reports, but they do not close
-- the same thing. Fifty NEW fingerprints per account per day: it is the only cap that bounds storage, since
-- only an unseen fingerprint creates a row. An application crashing in fifty different ways in the same day
-- has problems this file will not fix. And thirty seconds between two increments of the same fingerprint:
-- the client already holds back, but the client is code that can be bypassed, and without this second
-- guardrail a loop would call the function continuously. The storage cost stays modest — 4.5 kB at worst per
-- row, against 1.5 MB for a report screenshot — so it is the number of calls, not the bytes, that is bounded
-- here.
--
-- RETENTION. Thirty days. An error is a diagnosis, not an archive: after a month, either it has been fixed,
-- or it has happened again and its row has been refreshed. The clean-up happens on every call to
-- report_crash, as redeem_invite cleans its attempts — no scheduled task to watch, and nothing grows when
-- nothing crashes. The administration read filters on the same window, so that the screen never shows beyond
-- the announced retention even if no clean-up has run for a long time.
--
-- AUTHENTICATED SESSION, NOT APPROVED ACCOUNT. Every other write goes through `is_approved()`. Not this one,
-- and that is deliberate: an account awaiting validation sees the waiting screen, and if IT is what crashes,
-- nobody will ever know — that person does not even have access to the report form. The risk taken is nil in
-- comparison: the function is granted to `authenticated` only, it returns no data, and the same caps apply.
--
-- The function does not raise when a cap is reached, for the same reason as submit_bug_report: an exception
-- would roll the transaction back. Here it would roll back the retention clean-up and the counter increment.
-- It returns an object describing the outcome. And in any case nothing it returns reaches anybody's eyes:
-- the reporter on the client side swallows everything. A failure of the error reporter must never become, in
-- itself, a visible error.

create table public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  fingerprint text not null check (char_length(fingerprint) between 1 and 64),
  source text not null check (source in ('window', 'promise', 'render', 'sync')),
  -- 500 characters: enough to read a whole error message, not enough to receive a document.
  message text not null check (char_length(message) between 1 and 500),
  stack text check (stack is null or char_length(stack) <= 4000),
  path text,
  user_agent text,
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_at timestamptz
);

-- The deduplication key. `user_id` can become null if the account is deleted: nulls are distinct for a
-- unique index, so those orphan rows simply stop grouping. They are never updated again and retention takes
-- them away.
create unique index client_errors_user_print on public.client_errors (user_id, fingerprint);

create index client_errors_recent on public.client_errors (last_seen_at desc);

alter table public.client_errors enable row level security;

-- No policy: like bug_reports, the table only opens through the security definer functions below. Nobody can
-- read other people's crashes, nor erase their own to give themselves a fresh quota.
revoke all on public.client_errors from public, anon, authenticated;

create or replace function public.report_crash(
  fingerprint text,
  source text,
  message text,
  stack text,
  path text,
  user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
  existing public.client_errors;
  fresh_count integer;
begin
  author := (select auth.uid());

  if author is null then
    return jsonb_build_object('status', 'ignored');
  end if;

  if source not in ('window', 'promise', 'render', 'sync') then
    return jsonb_build_object('status', 'ignored');
  end if;

  -- An empty message tells nobody anything and does not deserve a row. The client should never send one, but
  -- the function can be called without going through it.
  if coalesce(trim(message), '') = '' or coalesce(trim(fingerprint), '') = '' then
    return jsonb_build_object('status', 'ignored');
  end if;

  delete from public.client_errors
  where last_seen_at < now() - interval '30 days';

  select * into existing
  from public.client_errors e
  where e.user_id = author and e.fingerprint = report_crash.fingerprint
  for update;

  if existing.id is not null then
    -- The same crash, seen again too soon: we do not rewrite the row. Thirty seconds are enough to tell "it
    -- is happening again" from a loop spinning out of control.
    if existing.last_seen_at > now() - interval '30 seconds' then
      return jsonb_build_object('status', 'throttled');
    end if;

    update public.client_errors e
    set occurrences = e.occurrences + 1,
        last_seen_at = now(),
        path = coalesce(nullif(report_crash.path, ''), e.path),
        -- A filed error that reappears reopens: otherwise a bug resolved too quickly goes on breaking screens
        -- without ever reaching the administration screen.
        status = 'open',
        resolved_at = null
    where e.id = existing.id;

    return jsonb_build_object('status', 'recorded');
  end if;

  select count(*) into fresh_count
  from public.client_errors e
  where e.user_id = author
    and e.first_seen_at > now() - interval '24 hours';

  if fresh_count >= 50 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.client_errors (
    user_id, fingerprint, source, message, stack, path, user_agent
  )
  values (
    author,
    report_crash.fingerprint,
    report_crash.source,
    left(report_crash.message, 500),
    left(nullif(report_crash.stack, ''), 4000),
    nullif(report_crash.path, ''),
    nullif(report_crash.user_agent, '')
  );

  return jsonb_build_object('status', 'recorded');
end;
$$;

revoke all on function public.report_crash(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.report_crash(text, text, text, text, text, text) to authenticated;

/*
 * The administration read, grouped by fingerprint.
 *
 * No email address, unlike list_bug_reports, and that is the fundamental difference between the two screens:
 * a report is written deliberately by somebody who accepts being contacted back, a crash happens without
 * anybody deciding it. So we return the number of accounts affected, which is the information useful for
 * prioritising, and nothing that designates a person.
 *
 * The message and the stack kept are those of the most recent occurrence: at equal fingerprint they differ
 * only in details already cleaned, and taking the most recent avoids showing a stack from a version of the
 * code that no longer exists.
 */
create or replace function public.list_client_errors()
returns table (
  fingerprint text,
  source text,
  message text,
  stack text,
  path text,
  user_agent text,
  occurrences bigint,
  people bigint,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (e.fingerprint)
    e.fingerprint,
    e.source,
    e.message,
    e.stack,
    e.path,
    e.user_agent,
    sum(e.occurrences) over (partition by e.fingerprint),
    count(*) over (partition by e.fingerprint),
    min(e.first_seen_at) over (partition by e.fingerprint),
    max(e.last_seen_at) over (partition by e.fingerprint),
    case
      when bool_or(e.status = 'open') over (partition by e.fingerprint) then 'open'
      else 'resolved'
    end
  from public.client_errors e
  where public.is_admin()
    and e.last_seen_at > now() - interval '30 days'
  order by e.fingerprint, e.last_seen_at desc
$$;

revoke all on function public.list_client_errors() from public, anon, authenticated;
grant execute on function public.list_client_errors() to authenticated;

-- Filing away applies to the fingerprint, not to a row: it is the bug that is declared fixed, and it has one
-- row per account affected.
create or replace function public.resolve_client_error(target text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  update public.client_errors
  set status = 'resolved', resolved_at = now()
  where fingerprint = target and status = 'open';
end;
$$;

revoke all on function public.resolve_client_error(text) from public, anon, authenticated;
grant execute on function public.resolve_client_error(text) to authenticated;

comment on table public.client_errors is
  'Plantages JavaScript non rattrapes, nettoyes cote client puis dedupliques par (compte, empreinte). Retention de trente jours, appliquee a chaque appel de report_crash.';

comment on column public.client_errors.fingerprint is
  'Empreinte stable calculee par le client (src/lib/domain/crash.ts) : source, message normalise et premiere image de la pile sans numero de ligne.';

comment on function public.report_crash(text, text, text, text, text, text) is
  'Enregistre un plantage sous deux plafonds : cinquante empreintes inedites par compte et par jour, et trente secondes entre deux occurrences d une meme empreinte. Ne leve jamais.';
