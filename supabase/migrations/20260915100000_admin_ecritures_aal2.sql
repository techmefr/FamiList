-- The administration panel goes behind the second step, like the rest.
--
-- `is_approved()` was redefined by the MFA migration: as soon as an account has a verified factor, it
-- requires the session to have actually presented it. Every access rule to a household's data goes through
-- it. `is_admin()`, for its part, has never moved: `admin` role and `approved` status, with not a word about
-- the authentication level.
--
-- The asymmetry reads simply: somebody obtaining an administrator's password without their second factor
-- sees no shopping list, but can call `review_account`, `set_demo` and `reset_demo` directly on the API.
-- They validate their own pending account, mark it as demonstration, and they are in. The administrator's
-- 2FA protected only their shopping, not the instance.
--
-- What is locked here, and what is not. The writes, all of them. The reads (`pending_accounts`,
-- `list_bug_reports`), no: they keep `is_admin()` alone. A blocked administrator must be able to see the
-- screen and understand why they are refused, rather than meet a "reserved for administrators" that would
-- make them think they had lost their role. And that opens nothing new: the `profiles_select` rule already
-- lets `is_admin()` read every profile, and those two functions already existed with that same guardrail.
--
-- The trap to avoid was lockout: requiring aal2 to reach `/admin` would lock out the administrator who loses
-- their phone. There is no lockout, because the way back does not go through `/admin` and existed before
-- this file:
--
--   1. the backup codes — `consume_backup_code` is called from a session left at aal1, removes the factor,
--      and the `/auth/mfa` screen offers them from the first view;
--   2. failing that, a second administrator and `admin_reset_mfa`, set by the previous migration;
--   3. as a last resort, the out-of-application procedure documented in that same migration.
--
-- An administrator account with no verified factor is hindered by nothing: `is_approved()` only demands aal2
-- from those who have imposed it on themselves. The lock set here follows that account, it does not invent
-- it.
--
-- Two refusals, two messages. "reserved for administrators" means "this is not your role" and has no
-- follow-up; "elevation required" means "it is indeed your role, finish signing in" and has a way out.
-- Merging them under a single text would send half of people looking in the wrong place.

/*
 * The guardrail common to every write of the panel.
 *
 * Written once rather than copied seven times: it is the kind of condition people forget to carry over to
 * the eighth function, and the omission does not show — the function works, it just also works for whoever
 * should not.
 *
 * The order of the two tests makes the message: `is_admin()` says nothing about the authentication level,
 * `is_approved()` says nothing about the role. Tested in this order, the refusal that comes out names the
 * right cause.
 *
 * The `revoke` names `anon` and `authenticated` on top of `public`: the project's default privileges grant
 * execution of any new function to those two roles, and a `revoke ... from public` alone leaves them in
 * place. Only the `security definer` functions below call this one, under the owner account. Nothing added
 * here is reachable through an access rule.
 */
create or replace function public.assert_admin_write()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'reserve aux administrateurs' using errcode = '42501';
  end if;

  if not public.is_approved() then
    raise exception 'elevation requise' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_admin_write() from public, anon, authenticated;

comment on function public.assert_admin_write() is
  'Refuse une ecriture d administration, en distinguant le role manquant de la session non elevee. Appelee par les fonctions du panneau, jamais accordee a authenticated.';

-- Validating or refusing a sign-up. The body does not change: only the guardrail opens less.
create or replace function public.review_account(target uuid, decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  if decision not in ('approved', 'rejected', 'pending') then
    raise exception 'decision invalide: %', decision using errcode = '22023';
  end if;

  if target = (select auth.uid()) then
    raise exception 'un administrateur ne revise pas son propre compte' using errcode = '42501';
  end if;

  update public.profiles
  set status = decision,
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
  where id = target;
end;
$$;

-- Marking an account as demonstration, which validates it along the way: one more write that opened the
-- instance with no second factor.
create or replace function public.set_demo(target uuid, demo boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  -- A demonstration account is open by definition: marking it validates it.
  update public.profiles
  set is_demo = demo,
      status = case when demo then 'approved' else status end,
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
  where id = target;
end;
$$;

-- The most destructive of the three: it empties the demonstration household.
create or replace function public.reset_demo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  demo_household uuid;
begin
  perform public.assert_admin_write();

  select m.household_id into demo_household
  from public.household_members m
  join public.profiles p on p.id = m.user_id
  where p.is_demo
  limit 1;

  if demo_household is null then
    raise exception 'aucun compte de demonstration' using errcode = '22023';
  end if;

  delete from public.lists where household_id = demo_household;
  delete from public.shops where household_id = demo_household;
  delete from public.loyalty_cards where household_id = demo_household;
  delete from public.aisles where household_id = demo_household;

  insert into public.aisles (household_id, name, emoji, position, kind)
  values
    (demo_household, 'Fruits & Légumes', '🥬', 0, 'fruits'),
    (demo_household, 'Boulangerie', '🥖', 1, 'boulangerie'),
    (demo_household, 'Produits laitiers', '🥛', 2, 'laitier'),
    (demo_household, 'Viande & Poisson', '🐟', 3, 'viande'),
    (demo_household, 'Épicerie', '🫙', 4, 'epicerie'),
    (demo_household, 'Entretien', '🧴', 5, 'maison');

  insert into public.lists (household_id, name, emoji, color)
  values (demo_household, 'Courses de la semaine', '🛒', '#C8532A');
end;
$$;

-- Absent from the statement of the problem, but it is the same door: an administration write guarded by
-- `is_admin()` alone. Leaving it out would have made this file a fix with holes.
create or replace function public.resolve_bug_report(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  update public.bug_reports
  set status = 'resolved', resolved_at = now()
  where id = target;
end;
$$;

-- The three functions of the previous migration already required aal2, through an `is_admin() and
-- is_approved()` that returned only one message for two causes. They go through the common guardrail: the
-- same lock as before, the right message, and a single definition to read again the day this rule changes.
create or replace function public.promote_admin(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  if not exists (
    select 1 from public.profiles where id = target and status = 'approved'
  ) then
    raise exception 'le compte doit etre valide avant d etre promu' using errcode = '42501';
  end if;

  update public.profiles set role = 'admin' where id = target;
end;
$$;

create or replace function public.demote_admin(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  update public.profiles set role = 'user' where id = target;
end;
$$;

/*
 * `target <> auth.uid()` stays written, and for the same reason as before: this function must not be usable
 * by its caller to unlock themselves, and that ban must not depend on another function's definition. The
 * aal2 guardrail already forbids it twice.
 */
create or replace function public.admin_reset_mfa(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

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

comment on function public.review_account(uuid, text) is
  'Valide ou refuse une inscription. Reserve a un administrateur dont la session est au niveau que son compte s impose.';
comment on function public.set_demo(uuid, boolean) is
  'Marque un compte de demonstration, ce qui le valide. Meme garde-fou que la validation d un compte.';
comment on function public.resolve_bug_report(uuid) is
  'Clot un signalement. Ecriture d administration, donc derriere la deuxieme etape.';
