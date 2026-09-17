-- Taking part in a list and being able to read it become the same thing.
--
-- Until now list_members was only a marker: reading, for its part, was open to the whole household. From now
-- on the row in list_members is the key. Everything belonging to a list — items, messages, polls, options,
-- votes — already goes through can_access_list: redefining that single function closes the content in one
-- go. That leaves only the lists table itself, whose policy looked at household membership.
--
-- Sharing stays the starting position: a list is born open to the whole household, and it is removal that is
-- a deliberate gesture. The opposite — a private list to be opened person by person — would turn every
-- shopping trip into a configuration chore, in an application whose very object is the shared list.

-- 1. Nobody loses a list along the way.
--
-- The state equivalent to "the whole household read everything", once the rule has changed, is that each
-- person is signed up to their household's lists.
insert into public.list_members (list_id, user_id)
select l.id, m.user_id
from public.lists l
join public.household_members m on m.household_id = l.household_id
on conflict do nothing;

-- 2. The key, from now on, is the row in list_members.
--
-- The function stays security definer: it reads list_members without going back through that table's policy,
-- which is precisely what calls it. Without that, the check would go round in circles.
--
-- A consequence to keep in mind: somebody removed from a list cannot put themselves back on it alone, since
-- list_members's write policy relies on that same function.
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

-- 3. A list that has just been born has no member, so nobody to open it.
--
-- The trigger signs up the whole household. It looks at household_members rather than auth.uid() because
-- lists are not all created by their future reader: ensure_household lays down a new account's starting
-- list, and reset_demo repopulates the demonstration household from an administrator's account, which itself
-- has no business being there.
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

-- 4. Somebody arriving in the household joins the open lists, not the others.
--
-- Without that, a newcomer opens an empty application. But signing them up everywhere would let a stranger
-- into a list from which people had precisely been removed: they are therefore only added to the lists where
-- every other household member already appears, that is, the ones nobody has restricted.
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

-- 5. Leaving the household also closes its lists.
--
-- list_members points only at auth.users: without this trigger, somebody who has left the household would
-- keep their rows, and therefore their access, which would empty the new rule of its meaning.
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

-- 6. The lists table follows the same rule, except on insert.
--
-- The old "for all" policy mixed the four operations; they have to be separated, insertion being the only
-- moment when household membership is enough — the list has no member yet, and a policy founded on
-- can_access_list would refuse itself.
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
