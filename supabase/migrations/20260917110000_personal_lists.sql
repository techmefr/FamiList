-- A list stays personal as long as it is not shared.
--
-- A household is only a sharing circle: the family, a partner, colleagues. Belonging to several is the
-- point, and from then on a list no longer necessarily belongs to a circle. The one kept to yourself — the
-- presents, the medicine cabinet, the shopping list you do not want commented on — had no place until now:
-- lists.household_id was not null, so every list was born in a circle.
--
-- Two routes existed. An implicit solo circle per account would have changed nothing in the queries, but
-- that ghost circle would have appeared in every selector, every invitation, every counter, and it would
-- have had to be hidden everywhere, on every screen, indefinitely. The nullable column is paid for once,
-- here, in the policies — and it is covered by tests.
--
-- The trap is the null forgotten in a where: it either makes a list disappear or leaks it. So every policy
-- touching lists, list_members and items is rewritten explicitly below, even those that did not need to
-- change, with the reason written out.

-- 1. The column becomes nullable.
--
-- No existing list is touched: they all keep their circle. The null is reserved for what will be born
-- private.
alter table public.lists alter column household_id drop not null;

comment on column public.lists.household_id is
  'Le cercle avec lequel la liste est partagee, ou null si elle est personnelle. Partager une liste consiste a lui designer un cercle.';

-- 2. The sharing trigger is reversed.
--
-- It automatically enrolled every household member on every inserted list: exactly the opposite of the
-- settled model. Duplicating a list (#6) had already had to delete the members right after the insertion so
-- as not to leak the copy of a restricted list; that workaround disappears here.
--
-- A list is therefore born open to its author alone. That leaves the case where the author has no business
-- on it: the demonstration lists are inserted by an administrator who is not a member of the demonstration
-- household, and nobody would ever read them. We tell them apart by membership: if whoever inserts is not a
-- member of the circle aimed at, the list is set for that circle, not for them.
--
-- ensure_household, for its part, provisions the household of the account calling it: the author is a
-- member, and so is the only one enrolled, which is indeed the wanted default.
--
-- To remember: household_id says the scope, list_members says the access. Setting a circle at insertion time
-- therefore shares nothing on its own — enrolling the members stays a gesture, the gesture of sharing.
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

-- 3. lists's policies, read again one by one for the null.
--
-- select, update and delete go through can_access_list, which only looks at list_members: the null does not
-- concern them, a personal list has only one member and that is its author. They are rewritten identically
-- so that the review is recorded here rather than assumed.
drop policy if exists lists_select on public.lists;
create policy lists_select on public.lists for select
  using (public.can_access_list(id));

drop policy if exists lists_delete on public.lists;
create policy lists_delete on public.lists for delete
  using (public.can_access_list(id));

-- The insertion, for its part, changed meaning: is_household_member(null) is false, so the policy as it
-- stood refused every personal list. The null becomes the open door — with no circle, there is nothing to
-- check; with a circle, you have to belong to it, as before.
drop policy if exists lists_insert on public.lists;
create policy lists_insert on public.lists for insert
  with check (household_id is null or public.is_household_member(household_id));

-- The update is the hole the nullable column opened: sharing now consists in writing household_id, and the
-- old policy only checked access to the list. Any member could therefore push a list into a circle they are
-- not a member of, and make it readable there by strangers. The with check now looks at both sides.
drop policy if exists lists_update on public.lists;
create policy lists_update on public.lists for update
  using (public.can_access_list(id))
  with check (
    public.can_access_list(id)
    and (household_id is null or public.is_household_member(household_id))
  );

-- 4. list_members: who a list can open to.
--
-- The function checked that the person enrolled belongs to the household owning the list. With a null
-- household_id it returned false, so apart from the trigger, nobody — not even the author — could have
-- appeared on their own personal list.
--
-- The null is not handled by opening it to everybody: a list with no circle is not shared, that is the rule.
-- Only the caller can appear on it, and the policy already requires elsewhere that they have access —
-- in other words, on a personal list, you can only re-enrol yourself. Sharing requires giving it a circle
-- first.
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

-- 5. items, messages, polls: nothing to change, and that is verified.
--
-- All of a list's content goes through can_access_list(list_id), which only reads list_members. None of
-- these policies mentions household_id, so none of them could lose a personal list or let it leak. The items
-- policy is rewritten identically so that the review is recorded.
drop policy if exists items_all on public.items;
create policy items_all on public.items for all
  using (public.can_access_list(list_id))
  with check (public.can_access_list(list_id));

-- 6. The arrival and departure triggers, read again as well.
--
-- join_open_lists filters on l.household_id = new.household_id: a null never satisfies an equality, so
-- arriving in a circle has never given access to its members' personal lists. leave_household_lists filters
-- the same way: leaving a circle does not remove you from your own personal lists. Both come out right with
-- no change; they are covered by the tests.
