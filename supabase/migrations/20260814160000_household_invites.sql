-- Joining somebody's household.
--
-- Without this, each account lives in its own household and the application is shared with nobody: yet that
-- is its whole object. Sharing goes through a short code, read aloud or sent by message, valid for a limited
-- time.

create table public.household_invites (
  code text primary key,
  household_id uuid not null references public.households on delete cascade,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_by uuid references auth.users on delete set null,
  used_at timestamptz
);

alter table public.household_invites enable row level security;

-- A member sees and removes their household's invitations. Nobody can list other people's invitations: the
-- code is the secret, it must not be enumerable.
create policy household_invites_select on public.household_invites for select
  using (public.is_household_member(household_id));
create policy household_invites_delete on public.household_invites for delete
  using (public.is_household_member(household_id));

grant select, delete on public.household_invites to authenticated;

create or replace function public.create_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid;
  generated text;
begin
  select household_id into household
  from public.household_members
  where user_id = (select auth.uid())
  limit 1;

  if household is null or not public.is_household_member(household) then
    raise exception 'aucun foyer' using errcode = '42501';
  end if;

  -- Alphabet with no I, O, 0 or 1: the code is often dictated aloud or copied by hand.
  loop
    generated := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
        1 + floor(random() * 32)::int, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.household_invites where code = generated);
  end loop;

  insert into public.household_invites (code, household_id, created_by, expires_at)
  values (generated, household, (select auth.uid()), now() + interval '7 days');

  return generated;
end;
$$;

revoke all on function public.create_invite() from public;
grant execute on function public.create_invite() to authenticated;

/*
 * Consuming an invitation. Locks the row so that two devices entering the same code at the same instant do
 * not attach the person twice, and refuses an expired or already used code without saying which of the two:
 * an invalid code stays an invalid code.
 */
create or replace function public.redeem_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.household_invites;
  previous uuid;
  untouched boolean;
begin
  if not public.is_approved() then
    raise exception 'compte non valide' using errcode = '42501';
  end if;

  select * into invite
  from public.household_invites
  where code = upper(trim(invite_code))
  for update;

  if invite is null or invite.used_by is not null or invite.expires_at < now() then
    raise exception 'code invalide ou expire' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.household_members
    where household_id = invite.household_id and user_id = (select auth.uid())
  ) then
    return invite.household_id;
  end if;

  -- An account belongs to a single household: the one created for it at sign-up has no reason to exist any
  -- more if it joins a family. We only delete it if it has stayed empty, otherwise we refuse rather than
  -- erase shopping somebody has entered.
  select household_id into previous
  from public.household_members
  where user_id = (select auth.uid())
  limit 1;

  if previous is not null then
    select
      not exists (select 1 from public.items i join public.lists l on l.id = i.list_id where l.household_id = previous)
      and not exists (select 1 from public.shops where household_id = previous)
      and not exists (select 1 from public.loyalty_cards where household_id = previous)
      and (select count(*) from public.household_members where household_id = previous) = 1
    into untouched;

    if not untouched then
      raise exception 'quittez d abord votre foyer actuel' using errcode = '22023';
    end if;

    delete from public.households where id = previous;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (invite.household_id, (select auth.uid()), 'member');

  update public.household_invites
  set used_by = (select auth.uid()), used_at = now()
  where code = invite.code;

  return invite.household_id;
end;
$$;

revoke all on function public.redeem_invite(text) from public;
grant execute on function public.redeem_invite(text) to authenticated;

/*
 * Leaving a household. The delete policy lets a member remove anybody from the household; we keep that
 * behaviour, but we refuse to remove the last person: a household with no member would become invisible and
 * its data inaccessible to everyone.
 */
create or replace function public.leave_household(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_member(target) then
    raise exception 'foyer inconnu' using errcode = '42501';
  end if;

  if (select count(*) from public.household_members where household_id = target) <= 1 then
    raise exception 'un foyer ne peut pas rester sans membre' using errcode = '22023';
  end if;

  delete from public.household_members
  where household_id = target and user_id = (select auth.uid());
end;
$$;

revoke all on function public.leave_household(uuid) from public;
grant execute on function public.leave_household(uuid) to authenticated;

comment on table public.household_invites is
  'Code court permettant de rejoindre un foyer. Le code est le secret : il n est jamais enumerable par un non-membre.';
