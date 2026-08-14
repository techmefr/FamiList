alter table public.profiles
  add column role text not null default 'user' check (role in ('user', 'admin')),
  add column status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  add column is_demo boolean not null default false,
  add column requested_at timestamptz not null default now(),
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users on delete set null;

create index profiles_status_idx on public.profiles (status, requested_at);

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'approved'
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'approved'
  )
$$;

create or replace function public.is_household_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_approved() and exists (
    select 1 from public.household_members
    where household_id = target and user_id = (select auth.uid())
  )
$$;

create or replace function public.can_access_list(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_approved() and exists (
    select 1
    from public.lists l
    join public.household_members m on m.household_id = l.household_id
    where l.id = target and m.user_id = (select auth.uid())
  )
$$;

create or replace function public.can_access_shop(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_approved() and exists (
    select 1
    from public.shops s
    join public.household_members m on m.household_id = s.household_id
    where s.id = target and m.user_id = (select auth.uid())
  )
$$;

drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = (select auth.uid()) or public.is_admin());

revoke update on public.profiles from authenticated;
grant update (display_name, initial, tint, theme, type_scale) on public.profiles to authenticated;

create or replace function public.review_account(target uuid, decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'reserve aux administrateurs' using errcode = '42501';
  end if;

  if decision not in ('approved', 'rejected', 'pending') then
    raise exception 'decision invalide: %', decision using errcode = '22023';
  end if;

  if target = (select auth.uid()) then
    raise exception 'un administrateur ne revise pas son propre compte' using errcode = '42501';
  end if;

  update public.profiles
  set status = decision,
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
  where id = target;
end;
$$;

revoke all on function public.review_account(uuid, text) from public;
grant execute on function public.review_account(uuid, text) to authenticated;

create or replace function public.pending_accounts()
returns table (
  id uuid,
  display_name text,
  email text,
  requested_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, u.email::text, p.requested_at, p.status
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.requested_at
$$;

revoke all on function public.pending_accounts() from public;
grant execute on function public.pending_accounts() to authenticated;

grant execute on function public.is_approved() to authenticated;
grant execute on function public.is_admin() to authenticated;

comment on column public.profiles.status is
  'pending a l inscription. Aucun acces aux donnees tant que le compte n est pas approved: les trois fonctions d acces exigent is_approved().';
comment on column public.profiles.is_demo is
  'Compte de demonstration public. Approuve d office, sert a faire visiter l app sans validation.';
