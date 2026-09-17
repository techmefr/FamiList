-- Provisioning a new account's household.
--
-- Doing it in two calls from the client (insert household then insert household_members) would leave a window
-- where two devices of the same account each create their own household. So we do it in one transaction, on
-- the database side, and we make it idempotent: an account already attached to a household simply gets its
-- identifier back.

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
  insert into public.aisles (household_id, name, emoji, position)
  values
    (created, 'Fruits & Légumes', '🥬', 0),
    (created, 'Boulangerie', '🥖', 1),
    (created, 'Produits laitiers', '🥛', 2),
    (created, 'Viande & Poisson', '🐟', 3),
    (created, 'Épicerie', '🫙', 4),
    (created, 'Entretien', '🧴', 5);

  insert into public.lists (household_id, name, emoji, color)
  values (created, 'Courses de la semaine', '🛒', '#C8532A');

  return created;
end;
$$;

revoke all on function public.ensure_household(text) from public;
grant execute on function public.ensure_household(text) to authenticated;

comment on function public.ensure_household(text) is
  'Renvoie le foyer du compte courant, en le creant avec ses rayons de depart au premier appel.';
