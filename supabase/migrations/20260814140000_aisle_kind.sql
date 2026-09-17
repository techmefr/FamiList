-- An aisle's category, stable and independent of the identifier and the name.
--
-- Automatic detection of the aisle from an item's name ("Vine tomatoes" -> fruit) reasons about categories,
-- not about identifiers: those are uuids specific to each household. Without this column, detection has
-- nothing to point at. It stays null for aisles created by the user, which are not part of detection.

alter table public.aisles add column kind text;

create unique index aisles_household_kind_idx
  on public.aisles (household_id, kind)
  where kind is not null;

comment on column public.aisles.kind is
  'Categorie de reference (fruits, boulangerie, laitier, viande, epicerie, maison). Nulle pour un rayon cree par l utilisateur.';

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
