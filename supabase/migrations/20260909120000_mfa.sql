-- Second factor, backup codes, and visible sessions.
--
-- Supabase can set a TOTP factor and raise a session to aal2, but it makes it compulsory nowhere: with no
-- rule on the database side, a session left at aal1 reads everything, and the 2FA is only one more screen at
-- opening time. So the lock is put here, once, in the function every access rule already calls.

/*
 * An account is valid if it is approved, and — if it has chosen a second factor — if the current session has
 * actually presented it.
 *
 * The condition is written in this precise direction: somebody with no verified factor is never hindered,
 * and somebody with one can no longer read their lists from a session that stopped at the password. That is
 * what makes the difference between a real 2FA and a decorative one, which any direct API call would bypass.
 *
 * `auth.jwt()` is read rather than the sessions table: the level reached is in the token, and a session
 * raised in the meantime carries it from its next refresh.
 */
create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'approved'
  )
  and (
    coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified'
    )
  )
$$;

comment on function public.is_approved() is
  'Approuve, et au niveau d authentification que le compte s est lui-meme impose. Toutes les regles d acces passent par elle.';

/*
 * The backup codes.
 *
 * Losing your phone must not mean losing your lists. These codes are the way out: each serves only once, and
 * using one disables the second factor instead of replacing its entry. That is intended — a code noted on a
 * piece of paper that would count indefinitely as a second factor would be a worse second factor. It brings
 * the account back to the state before the 2FA, leaving it to be enabled again from a device you still have.
 *
 * Only the hash is kept. The table has no access rule and nobody has the right to read it: it is touched
 * only through the three functions below.
 */
create table public.mfa_backup_codes (
  user_id uuid not null references auth.users on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  primary key (user_id, code_hash)
);

alter table public.mfa_backup_codes enable row level security;
revoke all on table public.mfa_backup_codes from anon, authenticated;

create index mfa_backup_codes_unused_idx
  on public.mfa_backup_codes (user_id)
  where used_at is null;

/*
 * How many codes are left. The number is enough for the security screen; the codes themselves never come
 * out again after their creation, which is the whole point of storing only hashes.
 */
create or replace function public.backup_codes_left()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.mfa_backup_codes
  where user_id = (select auth.uid()) and used_at is null
$$;

/*
 * Makes ten fresh codes and returns them in the clear, once only.
 *
 * The old ones disappear: having two valid sets at the same time would mean a sheet printed a year ago still
 * opens the account, when you believe you have replaced it.
 *
 * The format is ten characters drawn from an alphabet without the letters that get confused when read:
 * neither O nor I nor L nor U, which would be read as 0, 1, 1 and V. These codes are copied by hand, often
 * from paper, often badly.
 */
create or replace function public.create_backup_codes()
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  code text;
  i integer;
  j integer;
begin
  if (select auth.uid()) is null then
    raise exception 'session requise' using errcode = '42501';
  end if;

  delete from public.mfa_backup_codes where user_id = (select auth.uid());

  for i in 1..10 loop
    code := '';

    for j in 1..10 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;

    insert into public.mfa_backup_codes (user_id, code_hash)
    values (
      (select auth.uid()),
      extensions.crypt(code, extensions.gen_salt('bf'))
    );

    return next code;
  end loop;
end;
$$;

/*
 * Consumes a backup code and removes the second factor.
 *
 * Callable from a session left at aal1: that is precisely the situation where it is used, the phone lost and
 * the session stuck at the door. The code is marked used before the factor goes, so that an interrupted call
 * does not leave a still-valid code on an already open account.
 *
 * The comparison goes through `crypt`, so in roughly constant time for a given hash; limiting the number of
 * attempts is the API's job, as for a password.
 */
create or replace function public.consume_backup_code(code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  trouve text;
begin
  if moi is null then
    raise exception 'session requise' using errcode = '42501';
  end if;

  select code_hash into trouve
  from public.mfa_backup_codes
  where user_id = moi
    and used_at is null
    and code_hash = extensions.crypt(upper(trim(code)), code_hash)
  limit 1;

  if trouve is null then
    return false;
  end if;

  update public.mfa_backup_codes
  set used_at = now()
  where user_id = moi and code_hash = trouve;

  delete from auth.mfa_factors where user_id = moi;

  return true;
end;
$$;

revoke all on function public.backup_codes_left() from public;
revoke all on function public.create_backup_codes() from public;
revoke all on function public.consume_backup_code(text) from public;

grant execute on function public.backup_codes_left() to authenticated;
grant execute on function public.create_backup_codes() to authenticated;
grant execute on function public.consume_backup_code(text) to authenticated;

/*
 * The account's open sessions, and a way to close one.
 *
 * "Sign out everywhere" already exists on the Supabase side, but it is a sledgehammer: we want to be able to
 * close the lent tablet without signing ourselves out of the phone in our hand. The `auth.sessions` table
 * already carries what is needed to recognise a device — the date, the browser, the address — and nothing
 * else is exposed.
 *
 * `is_approved()` is deliberately not required: consulting and closing your own sessions must stay possible
 * from an aal1 session, otherwise somebody who has lost their second factor cannot even tidy up.
 */
create or replace function public.my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  refreshed_at timestamptz,
  user_agent text,
  ip text,
  aal text,
  current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.created_at,
    coalesce(s.refreshed_at at time zone 'utc', s.updated_at) as refreshed_at,
    s.user_agent,
    host(s.ip) as ip,
    s.aal::text,
    s.id = (select (auth.jwt() ->> 'session_id')::uuid) as current
  from auth.sessions s
  where s.user_id = (select auth.uid())
    and (s.not_after is null or s.not_after > now())
  order by coalesce(s.refreshed_at at time zone 'utc', s.updated_at) desc
$$;

/*
 * Closes a session. Your own included — it is a sign-out, and there is no reason to forbid it from the list
 * where you see it.
 */
create or replace function public.revoke_session(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'session requise' using errcode = '42501';
  end if;

  delete from auth.sessions where id = target and user_id = (select auth.uid());
end;
$$;

revoke all on function public.my_sessions() from public;
revoke all on function public.revoke_session(uuid) from public;

grant execute on function public.my_sessions() to authenticated;
grant execute on function public.revoke_session(uuid) to authenticated;

comment on table public.mfa_backup_codes is
  'Condensats des codes de secours. Aucune regle d acces: la table ne se lit que par les fonctions security definer.';
comment on function public.consume_backup_code(text) is
  'Retire le deuxieme facteur contre un code a usage unique. Appelable en aal1, c est le but.';
comment on function public.my_sessions() is
  'Les sessions ouvertes du compte appelant, sans passer par la cle de service.';

/*
 * The lists go back through the common door.
 *
 * `can_access_list` had lost the call to `is_approved()` when it became a list-membership rule: since then,
 * a rejected account kept its rows in `list_members` and therefore went on reading its lists, while its
 * shops and its household were indeed closed to it. Putting it back repairs that gap and, at the same time,
 * extends the second-factor lock to the lists, the items, the messages and the polls, which all go through
 * here.
 *
 * Membership stays the rule: being approved is not enough to open somebody else's list.
 */
create or replace function public.can_access_list(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_approved() and exists (
    select 1
    from public.list_members lm
    where lm.list_id = target and lm.user_id = (select auth.uid())
  )
$$;

-- Removing your own vote was the last write that required nothing: neither an approved account nor a second
-- factor. It falls in line with the rest.
drop policy poll_votes_delete on public.poll_votes;
create policy poll_votes_delete on public.poll_votes for delete
  using (public.is_approved() and user_id = (select auth.uid()));
