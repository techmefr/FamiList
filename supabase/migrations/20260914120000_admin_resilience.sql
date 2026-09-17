-- No longer depending on a single account, nor on a single phone.
--
-- Two failures look alike and had no answer in the app. The only administrator loses their second factor:
-- `is_approved()` requires aal2 as soon as a verified factor exists, so nothing opens any more. Or that
-- account disappears altogether: nobody can validate a sign-up any more, and the instance closes itself
-- down. Both were settled until now with a SQL editor on production, which is not a procedure, it is an
-- admission.
--
-- What already exists and is not redone: the backup codes (`consume_backup_code`) cover the common case of a
-- lost phone, including for an administrator, and from a session left at aal1. This file only deals with
-- what they do not cover.
--
-- The fundamental choice: none of these functions bypasses the 2FA of whoever calls it. An emergency door
-- opened by its own owner is not an emergency door, it is one lock fewer. The common guardrail is therefore
-- `is_admin() and is_approved()`: a valid administrator, at the authentication level their account has
-- imposed on itself. An administrator stuck at aal1 can therefore unlock nothing, neither for themselves nor
-- for anybody else — that is intended.
--
-- That leaves one case no code can handle honestly: the last administrator, with no backup codes and no
-- second factor. Giving them a way out in the app would mean giving whoever takes their password an
-- identical way out. That case is handled outside the app, with the service key, and the only thing to do is
-- to appoint a second administrator:
--
--   update public.profiles set role = 'admin', status = 'approved'
--   where id = (select id from auth.users where email = 'somebody@example.com');
--
-- then, from that account, to use `admin_reset_mfa` on the blocked account. That is the documented procedure
-- asked for, and it exists only because the sole alternative would be a back door.
--
-- The trigger below makes that case rare: the last administrator can no longer be demoted or refused,
-- neither by the app nor by a direct write.

/*
 * Appointing a second administrator.
 *
 * It is the answer to the fundamental failure: while there is only one account able to validate sign-ups and
 * unblock the others, all the rest is only patching around it.
 *
 * The target must already be approved. Promoting a pending account would amount to validating it along the
 * way, skipping `review_account` and the trace it leaves in `reviewed_by`.
 *
 * No access rule is added on `profiles`: `role` stays outside the `grant update` given to `authenticated`,
 * and that column is only changed from here.
 */
create or replace function public.promote_admin(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() and public.is_approved()) then
    raise exception 'reserve aux administrateurs' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles where id = target and status = 'approved'
  ) then
    raise exception 'le compte doit etre valide avant d etre promu' using errcode = '42501';
  end if;

  update public.profiles set role = 'admin' where id = target;
end;
$$;

/*
 * Removing the administrator role.
 *
 * Demoting yourself is allowed: it is the normal gesture when handing over after appointing your successor.
 * What is forbidden is reaching zero — the trigger below takes care of that, so that the ban also holds on a
 * write that would not go through here.
 */
create or replace function public.demote_admin(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() and public.is_approved()) then
    raise exception 'reserve aux administrateurs' using errcode = '42501';
  end if;

  update public.profiles set role = 'user' where id = target;
end;
$$;

/*
 * Removing another account's second factor.
 *
 * It is the answer to the lost phone when the ten backup codes are lost too. The function brings the target
 * account back to the state before its 2FA, exactly as one of its own codes would: the factors go, and so do
 * the remaining codes. Keeping orphan hashes would only have left valid codes lying around for a 2FA that no
 * longer exists.
 *
 * `target <> auth.uid()` is the line that stops this function being a 2FA bypass. The aal2 guardrail already
 * forbids it — an administrator stuck at aal1 is not `is_approved()` — but the condition is written all the
 * same: it does not depend on another function's definition, and that is the kind of dependency we do not
 * want on that path.
 *
 * The target's sessions are closed. A session already raised to aal2 would stay so in its token while the
 * factor that justified it has just been removed: and that is precisely the session of whoever took the
 * phone.
 */
create or replace function public.admin_reset_mfa(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() and public.is_approved()) then
    raise exception 'reserve aux administrateurs' using errcode = '42501';
  end if;

  if target = (select auth.uid()) then
    raise exception 'un administrateur ne deverrouille pas son propre compte' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = target) then
    raise exception 'compte introuvable' using errcode = '42501';
  end if;

  delete from auth.mfa_factors where user_id = target;
  delete from public.mfa_backup_codes where user_id = target;
  delete from auth.sessions where user_id = target;
end;
$$;

/*
 * The last administrator does not leave.
 *
 * Demoting or refusing the only administrator account closes the instance for good from the app's point of
 * view: nobody can validate a sign-up any more, so nobody can become an administrator. The trigger is put on
 * the table rather than inside `demote_admin` so that it also holds against `review_account`, against a
 * correction made by hand, and against the service key — that is, against the three paths by which the
 * mistake would really arrive.
 *
 * Only `update` is watched. Deleting the profile follows the deletion of the `auth.users` account and
 * preventing it would make an account impossible to delete; that case is visible and can be recovered from,
 * whereas a demotion goes unnoticed until the next sign-up.
 */
create or replace function public.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.status = 'approved'
     and not (new.role = 'admin' and new.status = 'approved') then
    if not exists (
      select 1 from public.profiles
      where role = 'admin' and status = 'approved' and id <> old.id
    ) then
      raise exception 'il doit rester au moins un administrateur' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_keep_one_admin
  before update on public.profiles
  for each row
  execute function public.keep_one_admin();

-- The admin panel must be able to tell who is an administrator and who is blocked behind a lost factor. Two
-- more columns change the return type: Postgres refuses a plain replacement.
drop function public.pending_accounts();

create function public.pending_accounts()
returns table (
  id uuid,
  display_name text,
  email text,
  requested_at timestamptz,
  status text,
  is_demo boolean,
  role text,
  has_mfa boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    u.email::text,
    p.requested_at,
    p.status,
    p.is_demo,
    p.role,
    exists (
      select 1 from auth.mfa_factors f
      where f.user_id = p.id and f.status = 'verified'
    ) as has_mfa
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.requested_at
$$;

revoke all on function public.pending_accounts() from public;
revoke all on function public.promote_admin(uuid) from public;
revoke all on function public.demote_admin(uuid) from public;
revoke all on function public.admin_reset_mfa(uuid) from public;
revoke all on function public.keep_one_admin() from public;

grant execute on function public.pending_accounts() to authenticated;
grant execute on function public.promote_admin(uuid) to authenticated;
grant execute on function public.demote_admin(uuid) to authenticated;
grant execute on function public.admin_reset_mfa(uuid) to authenticated;

comment on function public.promote_admin(uuid) is
  'Nomme un second administrateur. Reserve a un administrateur valide et au niveau d authentification que son compte s impose.';
comment on function public.demote_admin(uuid) is
  'Retire le role administrateur. Le declencheur profiles_keep_one_admin empeche d arriver a zero.';
comment on function public.admin_reset_mfa(uuid) is
  'Retire le deuxieme facteur d un autre compte, jamais du sien. Dernier recours apres les codes de secours.';
comment on function public.keep_one_admin() is
  'Refuse la derniere retrogradation ou le dernier refus qui laisserait l instance sans administrateur.';
