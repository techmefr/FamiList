-- Provisionnement du foyer d'un nouveau compte.
--
-- Le faire en deux appels depuis le client (insert household puis insert household_members)
-- laisserait une fenetre ou deux appareils du meme compte creent chacun leur foyer. On le fait
-- donc en une transaction, cote base, et on le rend idempotent : un compte deja rattache a un
-- foyer recupere simplement son identifiant.

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

  -- Rayons de depart, dans l'ordre d'une grande surface classique. Sans eux, un nouveau compte
  -- ouvre une application vide ou rien ne peut etre range.
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
