-- Compte de demonstration.
--
-- Il sert a faire visiter l'application sans attendre une validation. Il est donc utilise par des
-- inconnus, qui cochent, renomment et suppriment : son foyer doit pouvoir revenir a son etat de
-- depart. Le compte lui-meme est cree comme n'importe quel autre — une inscription normale — puis
-- marque ici : creer un utilisateur demande la cle de service, qui n'a rien a faire dans ce depot.

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

  -- Un compte de demonstration est ouvert par definition : le marquer le valide.
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
 * Remet le foyer de demonstration dans son etat de depart : listes, articles, magasins, cartes,
 * messages et parcours appris disparaissent, les rayons reviennent.
 *
 * Volontairement destructeur et volontairement limite au foyer d'un compte marque `is_demo` : rien
 * ici ne peut atteindre le foyer d'une vraie famille, meme appele par erreur.
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

-- Les comptes listes dans le panneau admin portent desormais leur drapeau de demonstration.
-- La colonne ajoutee change le type de retour : Postgres refuse un simple remplacement.
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
