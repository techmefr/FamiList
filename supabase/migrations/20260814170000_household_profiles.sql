-- Names of the household's members.
--
-- The profiles read policy is deliberately narrow: each person reads only their own. But a household with no
-- names is unusable, you no longer know who took what. Rather than widening the policy — which would also
-- expose everyone's theme and text size — we expose through a function the only useful columns, and only for
-- people of the same household.

create or replace function public.household_profiles()
returns table (id uuid, display_name text, initial text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.initial
  from public.profiles p
  where public.is_approved()
    and exists (
      select 1
      from public.household_members mine
      join public.household_members theirs on theirs.household_id = mine.household_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = p.id
    )
$$;

revoke all on function public.household_profiles() from public;
grant execute on function public.household_profiles() to authenticated;
