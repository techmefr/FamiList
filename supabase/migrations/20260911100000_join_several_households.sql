-- Rejoindre un foyer n en fait plus quitter un autre.
--
-- Un foyer n est qu un cercle de partage : celui de la famille, celui du conjoint, celui des
-- collegues. redeem_invite tenait l invariant inverse — un compte, un foyer — en supprimant celui
-- de l inscription, et en refusant carrement quand il n etait pas vierge. La cle primaire de
-- household_members porte deja sur le couple (foyer, personne) : la forme des donnees n a jamais
-- interdit d appartenir a plusieurs foyers, seules ces lignes le faisaient.
--
-- Le reste de la fonction ne bouge pas : le verrou par compte, la lecture de l invitation pour
-- mise a jour, et le retour de l identifiant du foyer rejoint, dont l application se sert
-- desormais pour savoir quel foyer afficher.
create or replace function public.redeem_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.household_invites;
begin
  if not public.is_approved() then
    raise exception 'compte non valide' using errcode = '42501';
  end if;

  perform public.lock_household_membership();

  select * into invite
  from public.household_invites
  where code = upper(trim(invite_code))
  for update;

  if invite is null or invite.used_by is not null or invite.expires_at < now() then
    raise exception 'code invalide ou expire' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.household_members
    where household_id = invite.household_id and user_id = (select auth.uid())
  ) then
    return invite.household_id;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (invite.household_id, (select auth.uid()), 'member');

  update public.household_invites
  set used_by = (select auth.uid()), used_at = now()
  where code = invite.code;

  return invite.household_id;
end;
$$;

revoke all on function public.redeem_invite(text) from public;
grant execute on function public.redeem_invite(text) to authenticated;
