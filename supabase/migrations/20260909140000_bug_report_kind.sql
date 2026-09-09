alter table public.bug_reports
  add column kind text not null default 'bug' check (kind in ('bug', 'suggestion'));

create or replace function public.submit_bug_report(
  description text,
  screenshot text,
  path text,
  user_agent text,
  kind text default 'bug'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_id uuid;
begin
  if not public.is_approved() then
    raise exception 'reserve aux comptes approuves' using errcode = '42501';
  end if;

  if kind not in ('bug', 'suggestion') then
    raise exception 'type de signalement invalide: %', kind using errcode = '22023';
  end if;

  insert into public.bug_reports (user_id, description, screenshot, path, user_agent, kind)
  values ((select auth.uid()), description, nullif(screenshot, ''), nullif(path, ''), user_agent, kind)
  returning id into inserted_id;

  return inserted_id;
end;
$$;

-- L'ancienne fonction a quatre arguments : sans ce drop, elle coexisterait avec la nouvelle en tant
-- que surcharge distincte, et l'appel du client, qui nomme ses arguments, resterait ambigu.
drop function if exists public.submit_bug_report(text, text, text, text);

revoke all on function public.submit_bug_report(text, text, text, text, text) from public;
grant execute on function public.submit_bug_report(text, text, text, text, text) to authenticated;

-- Changement du type de retour (colonne "kind" ajoutee) : un simple create or replace le refuse,
-- la fonction doit disparaitre avant d'etre reposee.
drop function if exists public.list_bug_reports();

create or replace function public.list_bug_reports()
returns table (
  id uuid,
  email text,
  description text,
  screenshot text,
  path text,
  user_agent text,
  kind text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, u.email::text, r.description, r.screenshot, r.path, r.user_agent, r.kind, r.status, r.created_at
  from public.bug_reports r
  left join auth.users u on u.id = r.user_id
  where public.is_admin()
  order by r.created_at desc
$$;

revoke all on function public.list_bug_reports() from public;
grant execute on function public.list_bug_reports() to authenticated;
