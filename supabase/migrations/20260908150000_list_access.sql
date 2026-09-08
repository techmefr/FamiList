-- Participer a une liste et pouvoir la lire deviennent la meme chose.
--
-- Jusqu'ici list_members n'etait qu'un marqueur : la lecture, elle, etait ouverte a tout le foyer.
-- Desormais la ligne dans list_members est la cle. Tout ce qui appartient a une liste — articles,
-- messages, sondages, options, votes — passe deja par can_access_list : redefinir cette seule
-- fonction ferme le contenu d'un coup. Il ne reste que la table lists elle-meme, dont la policy
-- regardait l'appartenance au foyer.
--
-- Le partage reste la position de depart : une liste nait ouverte a tout le foyer, et c'est le
-- retrait qui est un geste. L'inverse — une liste privee qu'il faut ouvrir personne par personne —
-- transformerait chaque course en corvee de configuration, dans une application dont l'objet est
-- justement la liste commune.

-- 1. Personne ne perd une liste au passage.
--
-- L'etat equivalent a « tout le foyer lisait tout », une fois la regle changee, c'est que chacun
-- soit inscrit sur les listes de son foyer.
insert into public.list_members (list_id, user_id)
select l.id, m.user_id
from public.lists l
join public.household_members m on m.household_id = l.household_id
on conflict do nothing;

-- 2. La cle, desormais, c'est la ligne dans list_members.
--
-- La fonction reste security definer : elle lit list_members sans repasser par la policy de cette
-- table, laquelle l'appelle justement. Sans cela, la verification tournerait en rond.
--
-- Consequence a garder en tete : quelqu'un qu'on retire d'une liste ne peut pas s'y remettre seul,
-- puisque la policy d'ecriture de list_members s'appuie sur cette meme fonction.
create or replace function public.can_access_list(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.list_members lm
    where lm.list_id = target and lm.user_id = (select auth.uid())
  )
$$;

-- 3. Une liste qui vient de naitre n'a aucun membre, donc personne pour l'ouvrir.
--
-- Le declencheur y inscrit le foyer au complet. Il regarde household_members plutot que auth.uid()
-- parce que les listes ne sont pas toutes creees par leur futur lecteur : ensure_household pose la
-- liste de depart d'un nouveau compte, et reset_demo repeuple le foyer de demonstration depuis le
-- compte d'un administrateur qui, lui, n'a rien a y faire.
create or replace function public.share_list_with_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.list_members (list_id, user_id)
  select new.id, m.user_id
  from public.household_members m
  where m.household_id = new.household_id
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists lists_share_with_household on public.lists;
create trigger lists_share_with_household after insert on public.lists
  for each row execute function public.share_list_with_household();

-- 4. Quelqu'un qui arrive dans le foyer rejoint les listes ouvertes, pas les autres.
--
-- Sans cela, un nouveau venu ouvre une application vide. Mais l'inscrire partout ferait entrer un
-- inconnu dans une liste dont on avait justement retire du monde : on ne l'ajoute donc qu'aux
-- listes ou tous les autres membres du foyer figurent deja, c'est-a-dire celles que personne n'a
-- restreintes.
create or replace function public.join_open_lists()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.list_members (list_id, user_id)
  select l.id, new.user_id
  from public.lists l
  where l.household_id = new.household_id
    and not exists (
      select 1
      from public.household_members hm
      where hm.household_id = l.household_id
        and hm.user_id <> new.user_id
        and not exists (
          select 1
          from public.list_members lm
          where lm.list_id = l.id and lm.user_id = hm.user_id
        )
    )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists household_members_join_lists on public.household_members;
create trigger household_members_join_lists after insert on public.household_members
  for each row execute function public.join_open_lists();

-- 5. Quitter le foyer ferme aussi ses listes.
--
-- list_members ne pointe que vers auth.users : sans ce declencheur, une personne partie du foyer
-- garderait ses lignes, donc son acces, ce qui viderait la nouvelle regle de son sens.
create or replace function public.leave_household_lists()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.list_members lm
  using public.lists l
  where lm.list_id = l.id
    and l.household_id = old.household_id
    and lm.user_id = old.user_id;

  return old;
end;
$$;

drop trigger if exists household_members_leave_lists on public.household_members;
create trigger household_members_leave_lists after delete on public.household_members
  for each row execute function public.leave_household_lists();

-- 6. La table lists suit la meme regle, sauf a l'insertion.
--
-- L'ancienne policy « for all » melait les quatre operations ; il faut les separer, l'insertion
-- etant le seul moment ou l'appartenance au foyer suffit — la liste n'a alors pas encore de
-- membres, et une policy fondee sur can_access_list se refuserait elle-meme.
drop policy if exists lists_all on public.lists;

create policy lists_select on public.lists for select
  using (public.can_access_list(id));

create policy lists_insert on public.lists for insert
  with check (public.is_household_member(household_id));

create policy lists_update on public.lists for update
  using (public.can_access_list(id))
  with check (public.can_access_list(id));

create policy lists_delete on public.lists for delete
  using (public.can_access_list(id));
