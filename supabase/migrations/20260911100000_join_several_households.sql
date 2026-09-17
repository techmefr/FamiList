-- Joining a household no longer means leaving another.
--
-- A household is only a sharing circle: the family's, the partner's, the colleagues'. redeem_invite held the
-- opposite invariant — one account, one household — by deleting the sign-up one, and by refusing outright
-- when it was not untouched. household_members's primary key is already on the pair (household, person): the
-- shape of the data never forbade belonging to several households, only these lines did.
--
-- The rest of the function does not move: the per-account lock, reading the invitation for update, and
-- returning the identifier of the household joined, which the application now uses to know which household to
-- show.
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
