-- A report can no longer be filed over and over.
--
-- submit_bug_report had no ceiling at all: an approved account could post endlessly. The volume of rows is
-- not the real danger — the administration screen lists them all, and a few thousand rows drown the one
-- report that mattered. Storage is more so: each report can carry a capture of up to 1.5 MB of text in the
-- database, and two hundred captures are enough to weigh more than all the rest of the application's data put
-- together.
--
-- Hence two ceilings on the same rolling twenty-four-hour window, and not just one. Twenty reports a day:
-- nobody writes that many in good faith, and somebody going through a bad day of bugs is not cut off. Twelve
-- megabytes of captures over the same window: that is about ten full captures, well beyond honest use, and it
-- bounds what an account can make the database grow by in a day. Without the second ceiling, twenty full
-- captures a day per account would still get through.
--
-- No attempts table here, unlike redeem_invite: what we count are successful reports, and each already leaves
-- its row in bug_reports with its timestamp and its author. A parallel table would repeat the same
-- information. bug_reports offers the same guarantees: row level security enabled, no policy, every privilege
-- revoked — it is only reachable through the security definer functions, so nobody can erase their own rows
-- to give themselves a fresh quota.
--
-- The function does not raise an exception when the ceiling is reached. An exception would cancel the
-- transaction; here it would erase no counter, but it would leave the screen with a technical English message
-- coming from Postgres, untranslatable. So it returns, like redeem_invite, an object saying what happened,
-- and the interface chooses the words. Refusals that are not ceilings — unapproved account, invalid kind —
-- go on raising.

create index if not exists bug_reports_user_time on public.bug_reports (user_id, created_at desc);

-- Return type changed (uuid to jsonb): create or replace refuses it.
drop function if exists public.submit_bug_report(text, text, text, text, text);

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

  -- The byte ceiling only closes the attachment, never the report: text alone costs nothing and stays the
  -- only way to reach us. The capture in progress counts towards the ceiling it would cross, otherwise the
  -- last accepted send would exceed it by 1.5 MB.
  if nullif(screenshot, '') is not null
    and recent_bytes + char_length(screenshot) > 12000000
  then
    return jsonb_build_object('status', 'storage_limited');
  end if;

  insert into public.bug_reports (user_id, description, screenshot, path, user_agent, kind)
  values ((select auth.uid()), description, nullif(screenshot, ''), nullif(path, ''), user_agent, kind)
  returning id into inserted_id;

  return jsonb_build_object('status', 'submitted', 'id', inserted_id);
end;
$$;

revoke all on function public.submit_bug_report(text, text, text, text, text) from public;
grant execute on function public.submit_bug_report(text, text, text, text, text) to authenticated;

comment on function public.submit_bug_report(text, text, text, text, text) is
  'Depose un signalement sous deux plafonds par compte sur vingt-quatre heures glissantes : vingt signalements et douze megaoctets de captures. Renvoie un objet decrivant l issue plutot que de lever.';
