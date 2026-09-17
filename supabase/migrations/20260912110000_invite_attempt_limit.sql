-- An invitation code can no longer be guessed one after another.
--
-- redeem_invite could be called with no limit at all. The code is six characters in an alphabet of
-- thirty-two, that is a billion combinations: it is long, but a script running for weeks ends up hitting
-- one, and hitting a single live code is enough to enter somebody's home, see their shopping and their
-- loyalty cards. An invitation lives seven days; multiplied by the number of invitations open at a given
-- moment, the window is no longer theoretical.
--
-- We count per ACCOUNT, not per code. Locking a code after N failures would give anybody the means to stop a
-- family from joining up: they would only have to enter codes at random until they burnt the one the person
-- is waiting for. The denial of service would be easier to mount than the brute force we are trying to stop.
-- The account, for its part, is not a resource a third party can reach: redeem_invite already requires an
-- approved session, and nobody can consume somebody else's attempts. The IP address, meanwhile, does not
-- exist here — there is no intermediate service, the application is a static bundle talking to Postgres.
--
-- Ten failures per rolling quarter-hour: generous for anyone copying a code by hand and getting it wrong,
-- narrow for a script, which then tops out at a thousand attempts a day per account — negligible against the
-- billion combinations. A success wipes the slate.
--
-- The function no longer raises an exception when the code is refused, and that is the delicate point: an
-- exception cancels the whole transaction, hence also the write of the failed attempt. The counter would
-- never have remembered anything. It now returns an object saying what happened, and the write survives.
-- Refusals that do not concern the code — invalid account — go on raising, they count for nothing.

create table public.invite_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  attempted_at timestamptz not null default now()
);

create index invite_attempts_user_time on public.invite_attempts (user_id, attempted_at desc);

-- No policy, no grant: the table is only readable and writable by redeem_invite, which is security definer.
-- Letting an account erase its own attempts would amount to making the limit optional for it.
alter table public.invite_attempts enable row level security;

drop function if exists public.redeem_invite(text);

create or replace function public.redeem_invite(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.household_invites;
  failures integer;
begin
  if not public.is_approved() then
    raise exception 'compte non valide' using errcode = '42501';
  end if;

  perform public.lock_household_membership();

  delete from public.invite_attempts
  where user_id = (select auth.uid())
    and attempted_at < now() - interval '15 minutes';

  select count(*) into failures
  from public.invite_attempts
  where user_id = (select auth.uid());

  if failures >= 10 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  select * into invite
  from public.household_invites
  where code = upper(trim(invite_code))
  for update;

  -- Always the same answer for an unknown, already consumed or expired code: telling the three apart would
  -- tell a script which of its attempts hit an existing code.
  if invite is null or invite.used_by is not null or invite.expires_at < now() then
    insert into public.invite_attempts (user_id) values ((select auth.uid()));
    return jsonb_build_object('status', 'invalid');
  end if;

  delete from public.invite_attempts where user_id = (select auth.uid());

  if exists (
    select 1 from public.household_members
    where household_id = invite.household_id and user_id = (select auth.uid())
  ) then
    return jsonb_build_object('status', 'joined', 'household_id', invite.household_id);
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (invite.household_id, (select auth.uid()), 'member');

  update public.household_invites
  set used_by = (select auth.uid()), used_at = now()
  where code = invite.code;

  return jsonb_build_object('status', 'joined', 'household_id', invite.household_id);
end;
$$;

revoke all on function public.redeem_invite(text) from public;
grant execute on function public.redeem_invite(text) to authenticated;

comment on table public.invite_attempts is
  'Essais d invitation rates, par compte, sur une fenetre glissante. Nettoyee a chaque appel de redeem_invite.';
