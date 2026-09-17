-- A list only opens to members of the household.
--
-- list_members_all checked only the caller's access, never the user_id of the row being written: somebody
-- taking part in a list could give access to any account, household or not.

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
    join public.household_members hm on hm.household_id = l.household_id
    where l.id = target and hm.user_id = member
  )
$$;

comment on function public.list_belongs_to_household_of(uuid, uuid) is
  'Vrai si le compte donne appartient au foyer proprietaire de la liste. Security definer : la policy de list_members ne peut pas relire lists et household_members sous RLS.';

-- The triggers that populate list_members (sharing at creation, arrival in the household) are security
-- definer and do not go through this policy.
drop policy list_members_all on public.list_members;
create policy list_members_all on public.list_members for all
  using (public.can_access_list(list_id))
  with check (
    public.can_access_list(list_id)
    and public.list_belongs_to_household_of(list_id, user_id)
  );
