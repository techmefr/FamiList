-- Gives household_members.role a meaning.
--
-- Until now the column was decorative: the policies looked only at household membership. Any member could
-- therefore add any account to their household without going through an invitation, and exclude any other,
-- including the creator.

create or replace function public.is_household_owner(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_approved() and exists (
    select 1
    from public.household_members m
    where m.household_id = target
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  )
$$;

comment on function public.is_household_owner(uuid) is
  'Vrai si l appelant est le proprietaire du foyer. Security definer pour ne pas relire household_members sous RLS depuis une policy de cette meme table.';

-- Entering a household goes through ensure_household (creation) or redeem_invite (invitation), two security
-- definer functions that are not subject to this policy. That leaves only direct addition by the owner.
drop policy household_members_insert on public.household_members;
create policy household_members_insert on public.household_members for insert
  with check (public.is_household_owner(household_id));

-- Anyone can remove themselves from their household; only the owner can remove somebody else, and nobody can
-- remove an owner in their place.
drop policy household_members_delete on public.household_members;
create policy household_members_delete on public.household_members for delete
  using (
    user_id = (select auth.uid())
    or (public.is_household_owner(household_id) and role <> 'owner')
  );
