-- Categorie d'un rayon, stable et independante de l'identifiant et du nom.
--
-- La detection automatique du rayon a partir du nom d'un article ("Tomates grappe" -> fruits)
-- raisonne sur des categories, pas sur des identifiants : ceux-ci sont des uuid propres a chaque
-- foyer. Sans cette colonne, la detection ne peut rien designer. Elle reste nulle pour les rayons
-- crees par l'utilisateur, qui n'entrent pas dans la detection.

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

  -- Rayons de depart, dans l'ordre d'une grande surface classique. Sans eux, un nouveau compte
  -- ouvre une application vide ou rien ne peut etre range.
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
