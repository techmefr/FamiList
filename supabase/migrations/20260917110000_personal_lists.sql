-- Une liste reste personnelle tant qu on ne la partage pas.
--
-- Un foyer n est qu un cercle de partage : la famille, le conjoint, les collegues. Appartenir a
-- plusieurs est le but, et des lors une liste n appartient plus forcement a un cercle. Celle qu on
-- tient pour soi — les cadeaux, la pharmacie, la liste de courses qu on ne veut pas commenter —
-- n avait jusqu ici aucune place : lists.household_id etait not null, donc toute liste naissait
-- dans un cercle.
--
-- Deux voies existaient. Un cercle solo implicite par compte n aurait rien change aux requetes,
-- mais ce cercle fantome serait apparu dans tous les selecteurs, toutes les invitations, tous les
-- compteurs, et il aurait fallu le masquer partout, a chaque ecran, indefiniment. La colonne
-- nullable se paie une fois, ici, dans les politiques — et elle se couvre par des tests.
--
-- Le piege est le null oublie dans un where : il fait soit disparaitre une liste, soit fuiter.
-- Chaque politique touchant lists, list_members et items est donc reprise explicitement plus bas,
-- meme celles qui n avaient pas besoin de changer, avec la raison ecrite.

-- 1. La colonne devient nullable.
--
-- Aucune liste existante n est touchee : elles gardent toutes leur cercle. Le null est reserve a ce
-- qui naitra prive.
alter table public.lists alter column household_id drop not null;

comment on column public.lists.household_id is
  'Le cercle avec lequel la liste est partagee, ou null si elle est personnelle. Partager une liste consiste a lui designer un cercle.';

-- 2. Le declencheur de partage est inverse.
--
-- Il inscrivait d office tous les membres du foyer sur toute liste inseree : exactement le contraire
-- du modele retenu. La duplication de liste (#6) avait deja du supprimer les membres juste apres
-- l insertion pour ne pas fuiter la copie d une liste restreinte ; ce contournement disparait ici.
--
-- Une liste naît donc ouverte a son seul auteur. Reste le cas ou l auteur n a rien a y faire : les
-- listes de demonstration sont inserees par un administrateur qui n est pas membre du foyer de
-- demonstration, et personne ne les lirait jamais. On distingue par l appartenance : si celui qui
-- insere n est pas membre du cercle vise, la liste est posee pour ce cercle, pas pour lui.
--
-- ensure_household, lui, provisionne le foyer du compte qui l appelle : l auteur est membre, il est
-- donc le seul inscrit, ce qui est bien le defaut voulu.
--
-- A retenir : household_id dit la portee, list_members dit l acces. Poser un cercle a l insertion
-- ne partage donc rien a soi seul — inscrire les membres reste un geste, celui du partage.
create or replace function public.share_list_with_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  auteur uuid := (select auth.uid());
begin
  if new.household_id is not null and (
    auteur is null or not exists (
      select 1
      from public.household_members m
      where m.household_id = new.household_id and m.user_id = auteur
    )
  ) then
    insert into public.list_members (list_id, user_id)
    select new.id, m.user_id
    from public.household_members m
    where m.household_id = new.household_id
    on conflict do nothing;

    return new;
  end if;

  if auteur is not null then
    insert into public.list_members (list_id, user_id)
    values (new.id, auteur)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

-- 3. Les politiques de lists, relues une par une pour le null.
--
-- select, update et delete passent par can_access_list, qui ne regarde que list_members : le null
-- ne les concerne pas, une liste personnelle n a qu un membre et c est son auteur. Elles sont
-- reecrites a l identique pour que la relecture soit tracee ici plutot que supposee.
drop policy if exists lists_select on public.lists;
create policy lists_select on public.lists for select
  using (public.can_access_list(id));

drop policy if exists lists_delete on public.lists;
create policy lists_delete on public.lists for delete
  using (public.can_access_list(id));

-- L insertion, elle, changeait de sens : is_household_member(null) est faux, donc la policy telle
-- quelle refusait toute liste personnelle. Le null devient la porte ouverte — sans cercle, il n y a
-- rien a verifier ; avec un cercle, il faut y appartenir, comme avant.
drop policy if exists lists_insert on public.lists;
create policy lists_insert on public.lists for insert
  with check (household_id is null or public.is_household_member(household_id));

-- La mise a jour est le trou que la colonne nullable ouvrait : partager consiste desormais a ecrire
-- household_id, et l ancienne policy ne verifiait que l acces a la liste. N importe quel membre
-- pouvait donc pousser une liste dans un cercle dont il n est pas membre, et l y rendre lisible par
-- des inconnus. Le with check regarde maintenant les deux cotes.
drop policy if exists lists_update on public.lists;
create policy lists_update on public.lists for update
  using (public.can_access_list(id))
  with check (
    public.can_access_list(id)
    and (household_id is null or public.is_household_member(household_id))
  );

-- 4. list_members : a qui une liste peut s ouvrir.
--
-- La fonction verifiait que la personne inscrite appartient au foyer proprietaire de la liste. Avec
-- un household_id null elle rendait faux, donc le declencheur mis a part, plus personne — pas meme
-- l auteur — n aurait pu figurer sur sa propre liste personnelle.
--
-- Le null ne se traite pas en l ouvrant a tous : une liste sans cercle ne se partage pas, c est la
-- regle. Seul l appelant peut y figurer, et la policy exige deja par ailleurs qu il y ait acces —
-- autrement dit, sur une liste personnelle, on ne peut que se reinscrire soi-meme. Partager exige
-- de lui designer un cercle d abord.
create or replace function public.list_belongs_to_household_of(target uuid, member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lists l
    where l.id = target
      and (
        (l.household_id is null and member = (select auth.uid()))
        or exists (
          select 1
          from public.household_members hm
          where hm.household_id = l.household_id and hm.user_id = member
        )
      )
  )
$$;

comment on function public.list_belongs_to_household_of(uuid, uuid) is
  'Vrai si le compte donne peut figurer sur la liste : membre du cercle de la liste, ou l appelant lui-meme quand la liste est personnelle. Security definer : la policy de list_members ne peut pas relire lists et household_members sous RLS.';

drop policy if exists list_members_all on public.list_members;
create policy list_members_all on public.list_members for all
  using (public.can_access_list(list_id))
  with check (
    public.can_access_list(list_id)
    and public.list_belongs_to_household_of(list_id, user_id)
  );

-- 5. items, messages, sondages : rien a changer, et c est verifie.
--
-- Tout le contenu d une liste passe par can_access_list(list_id), qui ne lit que list_members.
-- Aucune de ces politiques ne mentionne household_id, donc aucune ne pouvait perdre une liste
-- personnelle ni la laisser fuiter. La policy des articles est reecrite a l identique pour que la
-- relecture soit tracee.
drop policy if exists items_all on public.items;
create policy items_all on public.items for all
  using (public.can_access_list(list_id))
  with check (public.can_access_list(list_id));

-- 6. Les declencheurs d arrivee et de depart, relus eux aussi.
--
-- join_open_lists filtre l.household_id = new.household_id : un null ne rejoint jamais une egalite,
-- donc arriver dans un cercle n a jamais donne acces aux listes personnelles de ses membres.
-- leave_household_lists filtre de la meme facon : quitter un cercle ne retire pas de ses propres
-- listes personnelles. Les deux tombent juste sans modification ; ils sont couverts par les tests.
