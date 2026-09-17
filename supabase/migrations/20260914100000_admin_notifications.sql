-- The administrator is told by email about sign-ups and reports.
--
-- Both events share the same problem: they exist only in /admin, and nobody watches /admin continuously. A
-- sign-up there is worse than a report — the account arrives `pending`, and the three access functions
-- require `is_approved()`: the person signs in and sees nothing, without knowing they are waiting for a
-- human validation. One single piece serves both.
--
-- The application is a static bundle: there is no server of ours to put an email send on. The path is
-- therefore database -> Edge Function. Three pieces, deliberately decoupled:
--
--   1. A buffer (`admin_notifications`) the triggers fill. A trigger making the network call itself would
--      put the latency — and the failure — of the email relay inside the sign-up transaction: a relay outage
--      would refuse sign-ups. Here the trigger only does a local insert, and its `exception when others`
--      block even swallows that. A sign-up and a report go through whatever happens to the email.
--   2. A sending function (`flush_admin_notifications`) called every five minutes by pg_cron, which wakes
--      the Edge Function through pg_net.
--   3. The `notify-admins` Edge Function, which claims the buffer and sends ONE grouped email.
--
-- Five minutes and a grouped email, rather than one email per event: a bad day of reports must not produce
-- forty emails, or the forty-first is no longer read. Five minutes stays a delay that somebody who has just
-- signed up does not perceive as an oversight. The grouping is free — it falls out of the fact that the
-- function empties the buffer.
--
-- Who is "the administrator"? Every account with `role = 'admin'` and `status = 'approved'`, not a
-- hard-coded address. The repository knows only one today, and issue #11 says precisely that this is a
-- single point of failure: the day a second administrator is appointed, they must receive the emails without
-- going through another migration. If there is no administrator, nothing is claimed and the buffer waits.
--
-- These emails cannot go through the SMTP already configured on the Supabase side: that one is only consumed
-- by Supabase Auth, for its own messages (confirmation, reset, invitation). Telling an administrator that a
-- sign-up is waiting is none of those messages, and Auth offers no arbitrary sending. Hence a sending path
-- of our own in the Edge Function, which speaks to the relay directly — the same credentials can serve it,
-- they just have to be given to it a second time, as function secrets.
--
-- Nothing secret here. The functions URL and the service key live in Supabase Vault, the SMTP credentials in
-- the Edge Function's secrets. Absent — and they are in CI as on a fresh database — each floor simply does
-- nothing: the cron does not post, and the function releases what it had claimed. No secret is required for
-- `db reset` to pass.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('signup', 'bug_report')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz
);

create index admin_notifications_pending_idx
  on public.admin_notifications (created_at)
  where sent_at is null;

alter table public.admin_notifications enable row level security;

-- No policy, like bug_reports: the table is only reachable through the security definer functions below. The
-- buffer copies an email address, and it has no business in the public API.
revoke all on public.admin_notifications from public, anon, authenticated;

comment on table public.admin_notifications is
  'Tampon des evenements a signaler aux administrateurs par courriel. Rempli par des declencheurs, vide toutes les cinq minutes par un courriel groupe.';
comment on column public.admin_notifications.claimed_at is
  'Pose au moment ou l Edge Function prend la ligne en charge. Repasse a null si l envoi echoue, et une reclamation de plus de cinq minutes est consideree perdue et reprise.';

create or replace function public.enqueue_signup_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only the accounts really waiting for a decision. The very first account is created `approved` by
  -- handle_new_user, and so is the demonstration account: reporting those two would amount to asking for a
  -- validation that has already happened.
  if new.status <> 'pending' or new.is_demo then
    return new;
  end if;

  insert into public.admin_notifications (kind, payload)
  values (
    'signup',
    jsonb_build_object(
      'profile_id', new.id,
      'display_name', new.display_name,
      'email', (select u.email::text from auth.users u where u.id = new.id)
    )
  );

  return new;
exception
  when others then
    -- A sign-up is never lost over an email. The event will be missing from the buffer, and the account will
    -- stay visible in /admin: the worst case is the one from before this migration.
    return new;
end;
$$;

create trigger profiles_notify_admins
  after insert on public.profiles
  for each row execute function public.enqueue_signup_notification();

create or replace function public.enqueue_bug_report_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_notifications (kind, payload)
  values (
    'bug_report',
    jsonb_build_object(
      'report_id', new.id,
      'report_kind', new.kind,
      'path', new.path,
      -- The whole description can reach four thousand characters, and the capture one and a half megabytes of
      -- base64: neither has any place in a wake-up email. The email says there is something to read, /admin
      -- gives it in full.
      'excerpt', left(new.description, 300),
      'has_screenshot', new.screenshot is not null,
      'email', (select u.email::text from auth.users u where u.id = new.user_id)
    )
  );

  return new;
exception
  when others then
    return new;
end;
$$;

create trigger bug_reports_notify_admins
  after insert on public.bug_reports
  for each row execute function public.enqueue_bug_report_notification();

create or replace function public.claim_admin_notifications()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipients jsonb;
  claimed jsonb;
begin
  select coalesce(jsonb_agg(u.email::text order by u.email), '[]'::jsonb)
  into recipients
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'admin' and p.status = 'approved' and u.email is not null;

  if recipients = '[]'::jsonb then
    return jsonb_build_object('recipients', recipients, 'notifications', '[]'::jsonb);
  end if;

  -- Purge first: a sent row now only serves to keep an address in the database.
  delete from public.admin_notifications
  where sent_at is not null and sent_at < now() - interval '30 days';

  with picked as (
    update public.admin_notifications n
    set claimed_at = now()
    where n.id in (
      select c.id
      from public.admin_notifications c
      where c.sent_at is null
        and (c.claimed_at is null or c.claimed_at < now() - interval '5 minutes')
      order by c.created_at
      limit 100
      for update skip locked
    )
    returning n.id, n.kind, n.payload, n.created_at
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', p.id, 'kind', p.kind, 'payload', p.payload, 'createdAt', p.created_at)
      order by p.created_at
    ),
    '[]'::jsonb
  )
  into claimed
  from picked p;

  return jsonb_build_object('recipients', recipients, 'notifications', claimed);
end;
$$;

create or replace function public.mark_admin_notifications_sent(ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.admin_notifications
  set sent_at = now()
  where id = any(ids) and sent_at is null;
$$;

create or replace function public.release_admin_notifications(ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.admin_notifications
  set claimed_at = null
  where id = any(ids) and sent_at is null;
$$;

revoke all on function public.claim_admin_notifications() from public, anon, authenticated;
revoke all on function public.mark_admin_notifications_sent(uuid[]) from public, anon, authenticated;
revoke all on function public.release_admin_notifications(uuid[]) from public, anon, authenticated;
grant execute on function public.claim_admin_notifications() to service_role;
grant execute on function public.mark_admin_notifications_sent(uuid[]) to service_role;
grant execute on function public.release_admin_notifications(uuid[]) to service_role;

create or replace function public.flush_admin_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  functions_url text;
  service_key text;
begin
  if not exists (select 1 from public.admin_notifications where sent_at is null) then
    return;
  end if;

  select s.decrypted_secret into functions_url
  from vault.decrypted_secrets s
  where s.name = 'admin_notifications_functions_url';

  select s.decrypted_secret into service_key
  from vault.decrypted_secrets s
  where s.name = 'admin_notifications_service_key';

  -- With no secrets, we attempt nothing. That is the case in CI and on a fresh database: the cron runs every
  -- five minutes producing neither an outgoing request nor an error in the logs.
  if functions_url is null or service_key is null then
    return;
  end if;

  perform net.http_post(
    url := functions_url || '/notify-admins',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb,
    -- pg_net's default five seconds are not enough: the function still has to open an SMTP session with the
    -- relay. We do not read the response anyway — it is the buffer that says what has left — but giving up at
    -- five seconds would cut the send in progress.
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.flush_admin_notifications() from public, anon, authenticated;

comment on function public.flush_admin_notifications() is
  'Reveille l Edge Function notify-admins si le tampon n est pas vide et si les secrets Vault sont poses. Ne leve jamais et n envoie rien elle-meme.';

do $$
begin
  perform cron.unschedule('familist-admin-notifications')
  where exists (select 1 from cron.job where jobname = 'familist-admin-notifications');

  perform cron.schedule(
    'familist-admin-notifications',
    '*/5 * * * *',
    $cron$select public.flush_admin_notifications()$cron$
  );
end;
$$;
