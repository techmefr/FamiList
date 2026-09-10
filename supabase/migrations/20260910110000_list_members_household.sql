-- Une liste ne s ouvre qu a des membres du foyer.
--
-- list_members_all ne verifiait que l acces de l appelant, jamais le user_id de la ligne ecrite :
-- quelqu un qui participe a une liste pouvait y donner acces a n importe quel compte, foyer
-- compris ou non.

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

-- Les declencheurs qui peuplent list_members (partage a la creation, arrivee dans le foyer) sont
-- security definer et ne passent pas par cette policy.
drop policy list_members_all on public.list_members;
create policy list_members_all on public.list_members for all
  using (public.can_access_list(list_id))
  with check (
    public.can_access_list(list_id)
    and public.list_belongs_to_household_of(list_id, user_id)
  );
