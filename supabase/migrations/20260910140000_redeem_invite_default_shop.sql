-- Joining a household becomes possible again.
--
-- redeem_invite deletes the household created at sign-up, but only if it has stayed untouched, and for that
-- it required it to have no shop at all. Yet the application itself lays down a default shop from the very
-- first opening: the condition was therefore always false, and the invitation failed systematically on
-- "leave your current household first".
--
-- The remedy that message points to does not exist: leave_household refuses to remove the last member, and a
-- sign-up household has only one. The person had no way out.
--
-- The items and lists branches already tolerated what is created automatically; the shops branch had not
-- followed when the default shop appeared. It now only counts shops somebody has really added, and a default
-- shop with no aisles is not one.

-- "One account, one household" is held by no constraint: household_members's primary key is on the pair
-- (household, person). The invariant lives only in these two functions, and they only have to cross for it to
-- fall — joining a family deletes the sign-up household while an ensure_household in flight, no longer seeing
-- it, immediately recreates one. The person then finds themselves in two households, and the application
-- shows them the wrong one.
--
-- One lock per account, taken by both functions, puts them in single file.
create or replace function public.lock_household_membership()
returns void
language sql
security definer
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtext('household:' || (select auth.uid())::text))
$$;

revoke all on function public.lock_household_membership() from public;

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

  perform public.lock_household_membership();

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
  order by joined_at
  limit 1;

  if previous is not null then
    select
      not exists (select 1 from public.items i join public.lists l on l.id = i.list_id where l.household_id = previous)
      and not exists (
        select 1
        from public.shops s
        where s.household_id = previous
          and (
            not s.is_default
            or exists (select 1 from public.shop_layouts sl where sl.shop_id = s.id and sl.learned)
            or exists (select 1 from public.shop_item_orders o where o.shop_id = s.id)
          )
      )
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

-- ensure_household takes the same lock, and rereads membership once it holds it: without that, it decides on
-- a state that may have changed in the meantime.
create or replace function public.ensure_household(household_name text default 'Ma maison')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
  created uuid;
begin
  if not public.is_approved() then
    raise exception 'compte non valide' using errcode = '42501';
  end if;

  perform public.lock_household_membership();

  select household_id into existing
  from public.household_members
  where user_id = (select auth.uid())
  order by joined_at
  limit 1;

  if existing is not null then
    return existing;
  end if;

  insert into public.households (name, created_by)
  values (coalesce(nullif(trim(household_name), ''), 'Ma maison'), (select auth.uid()))
  returning id into created;

  insert into public.household_members (household_id, user_id, role)
  values (created, (select auth.uid()), 'owner');

  -- Starting aisles, in the order of a classic supermarket. Without them, a new account opens an empty
  -- application where nothing can be filed.
  insert into public.aisles (household_id, name, emoji, position, kind)
  values
    (created, 'Fruits & Légumes', '🥬', 0, 'fruits'),
    (created, 'Boulangerie', '🥖', 1, 'boulangerie'),
    (created, 'Produits laitiers', '🥛', 2, 'laitier'),
    (created, 'Viande & Poisson', '🐟', 3, 'viande'),
    (created, 'Épicerie', '🫙', 4, 'epicerie'),
    (created, 'Entretien', '🧴', 5, 'maison');

  insert into public.lists (household_id, name, emoji, color)
  values (created, 'Courses de la semaine', '🛒', '#C8532A');

  return created;
end;
$$;

revoke all on function public.ensure_household(text) from public;
grant execute on function public.ensure_household(text) to authenticated;

-- create_invite took the caller's household with a limit 1 and no order: on an account with two, it picked
-- one at random. Same order as everywhere else, the oldest.
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
  order by joined_at
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
