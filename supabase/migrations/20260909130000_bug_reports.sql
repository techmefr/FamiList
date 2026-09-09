create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  description text not null check (char_length(description) between 1 and 4000),
  -- Une capture JPEG redimensionnée à 1280px tient largement sous ce plafond ; il coupe court à
  -- une image non redimensionnée envoyée par un client qui contournerait l'app.
  screenshot text check (screenshot is null or char_length(screenshot) <= 1500000),
  path text,
  user_agent text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index bug_reports_status_idx on public.bug_reports (status, created_at);

alter table public.bug_reports enable row level security;

-- Aucune policy : la table ne s'ouvre que par les fonctions security definer ci-dessous, jamais
-- par un select/insert direct depuis le client.
revoke all on public.bug_reports from public, anon, authenticated;

create or replace function public.submit_bug_report(
  description text,
  screenshot text,
  path text,
  user_agent text
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

  -- Le client Supabase genere des types qui refusent null sur un parametre text : on lui laisse
  -- passer une chaine vide et on la convertit ici plutot que de la stocker telle quelle.
  insert into public.bug_reports (user_id, description, screenshot, path, user_agent)
  values ((select auth.uid()), description, nullif(screenshot, ''), nullif(path, ''), user_agent)
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke all on function public.submit_bug_report(text, text, text, text) from public;
grant execute on function public.submit_bug_report(text, text, text, text) to authenticated;

create or replace function public.list_bug_reports()
returns table (
  id uuid,
  email text,
  description text,
  screenshot text,
  path text,
  user_agent text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, u.email::text, r.description, r.screenshot, r.path, r.user_agent, r.status, r.created_at
  from public.bug_reports r
  left join auth.users u on u.id = r.user_id
  where public.is_admin()
  order by r.created_at desc
$$;

revoke all on function public.list_bug_reports() from public;
grant execute on function public.list_bug_reports() to authenticated;

create or replace function public.resolve_bug_report(target uuid)
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
  set status = 'resolved', resolved_at = now()
  where id = target;
end;
$$;

revoke all on function public.resolve_bug_report(uuid) from public;
grant execute on function public.resolve_bug_report(uuid) to authenticated;

comment on column public.bug_reports.path is
  'Route ouverte au moment du signalement, capturee cote client : utile pour reproduire sans que la personne ait a la retaper.';
