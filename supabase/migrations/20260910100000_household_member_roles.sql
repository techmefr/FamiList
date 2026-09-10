-- Donne un sens a household_members.role.
--
-- Jusqu ici, la colonne etait decorative : les policies ne regardaient que l appartenance au
-- foyer. N importe quel membre pouvait donc ajouter n importe quel compte dans son foyer sans
-- passer par une invitation, et en exclure n importe quel autre, y compris le createur.

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

-- L entree dans un foyer passe par ensure_household (creation) ou redeem_invite (invitation),
-- deux fonctions security definer qui ne sont pas soumises a cette policy. Il ne reste donc
-- que l ajout direct par le proprietaire.
drop policy household_members_insert on public.household_members;
create policy household_members_insert on public.household_members for insert
  with check (public.is_household_owner(household_id));

-- Chacun peut se retirer de son foyer ; seul le proprietaire peut en retirer quelqu un d autre,
-- et personne ne peut retirer un proprietaire a sa place.
drop policy household_members_delete on public.household_members;
create policy household_members_delete on public.household_members for delete
  using (
    user_id = (select auth.uid())
    or (public.is_household_owner(household_id) and role <> 'owner')
  );
