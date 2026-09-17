-- Demonstration account.
--
-- It serves to show the application around without waiting for a validation. It is therefore used by
-- strangers, who tick, rename and delete: its household must be able to come back to its starting state. The
-- account itself is created like any other — a normal sign-up — then marked here: creating a user requires
-- the service key, which has no business in this repository.

create or replace function public.set_demo(target uuid, demo boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'reserve aux administrateurs' using errcode = '42501';
  end if;

  -- A demonstration account is open by definition: marking it validates it.
  update public.profiles
  set is_demo = demo,
      status = case when demo then 'approved' else status end,
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
  where id = target;
end;
$$;

revoke all on function public.set_demo(uuid, boolean) from public;
grant execute on function public.set_demo(uuid, boolean) to authenticated;

/*
 * Puts the demonstration household back into its starting state: lists, items, shops, cards, messages and
 * learnt layouts disappear, the aisles come back.
 *
 * Deliberately destructive and deliberately limited to the household of an account marked `is_demo`: nothing
 * here can reach a real family's household, even if called by mistake.
 */
create or replace function public.reset_demo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  demo_household uuid;
begin
  if not public.is_admin() then
    raise exception 'reserve aux administrateurs' using errcode = '42501';
  end if;

  select m.household_id into demo_household
  from public.household_members m
  join public.profiles p on p.id = m.user_id
  where p.is_demo
  limit 1;

  if demo_household is null then
    raise exception 'aucun compte de demonstration' using errcode = '22023';
  end if;

  delete from public.lists where household_id = demo_household;
  delete from public.shops where household_id = demo_household;
  delete from public.loyalty_cards where household_id = demo_household;
  delete from public.aisles where household_id = demo_household;

  insert into public.aisles (household_id, name, emoji, position, kind)
  values
    (demo_household, 'Fruits & Légumes', '🥬', 0, 'fruits'),
    (demo_household, 'Boulangerie', '🥖', 1, 'boulangerie'),
    (demo_household, 'Produits laitiers', '🥛', 2, 'laitier'),
    (demo_household, 'Viande & Poisson', '🐟', 3, 'viande'),
    (demo_household, 'Épicerie', '🫙', 4, 'epicerie'),
    (demo_household, 'Entretien', '🧴', 5, 'maison');

  insert into public.lists (household_id, name, emoji, color)
  values (demo_household, 'Courses de la semaine', '🛒', '#C8532A');
end;
$$;

revoke all on function public.reset_demo() from public;
grant execute on function public.reset_demo() to authenticated;

-- The accounts listed in the admin panel now carry their demonstration flag.
-- The added column changes the return type: Postgres refuses a plain replacement.
drop function public.pending_accounts();

create function public.pending_accounts()
returns table (
  id uuid,
  display_name text,
  email text,
  requested_at timestamptz,
  status text,
  is_demo boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, u.email::text, p.requested_at, p.status, p.is_demo
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.requested_at
$$;

revoke all on function public.pending_accounts() from public;
grant execute on function public.pending_accounts() to authenticated;

comment on function public.reset_demo() is
  'Remet le foyer de demonstration a zero. Ne peut atteindre que le foyer d un compte marque is_demo.';
