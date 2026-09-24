create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  email text not null check (
    char_length(email) <= 320 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  kind text not null check (
    kind in ('access', 'rectification', 'erasure', 'portability', 'objection', 'restriction', 'other')
  ),
  message text not null check (char_length(message) between 1 and 4000),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index privacy_requests_email_time on public.privacy_requests (lower(email), created_at desc);
create index privacy_requests_status_idx on public.privacy_requests (status, created_at);

alter table public.privacy_requests enable row level security;

revoke all on public.privacy_requests from public, anon, authenticated;

create or replace function public.submit_privacy_request(email text, kind text, message text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_id uuid;
  normalized text := lower(trim(submit_privacy_request.email));
  recent_for_email integer;
  recent_anonymous integer;
begin
  if kind not in ('access', 'rectification', 'erasure', 'portability', 'objection', 'restriction', 'other') then
    return jsonb_build_object('status', 'invalid');
  end if;

  if normalized !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or char_length(normalized) > 320
    or char_length(trim(message)) not between 1 and 4000
  then
    return jsonb_build_object('status', 'invalid');
  end if;

  select count(*) into recent_for_email
  from public.privacy_requests r
  where lower(r.email) = normalized
    and r.created_at > now() - interval '24 hours';

  if recent_for_email >= 3 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  if (select auth.uid()) is null then
    select count(*) into recent_anonymous
    from public.privacy_requests r
    where r.user_id is null
      and r.created_at > now() - interval '24 hours';

    if recent_anonymous >= 50 then
      return jsonb_build_object('status', 'rate_limited');
    end if;
  end if;

  insert into public.privacy_requests (user_id, email, kind, message)
  values ((select auth.uid()), normalized, kind, trim(message))
  returning id into inserted_id;

  return jsonb_build_object('status', 'submitted', 'id', inserted_id);
end;
$$;

revoke all on function public.submit_privacy_request(text, text, text) from public;
grant execute on function public.submit_privacy_request(text, text, text) to anon, authenticated;

create or replace function public.list_privacy_requests()
returns table (
  id uuid,
  email text,
  kind text,
  message text,
  has_account boolean,
  status text,
  created_at timestamptz,
  closed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.email, r.kind, r.message, r.user_id is not null, r.status, r.created_at, r.closed_at
  from public.privacy_requests r
  where public.is_admin()
  order by r.status = 'closed', r.created_at desc
$$;

revoke all on function public.list_privacy_requests() from public, anon;
grant execute on function public.list_privacy_requests() to authenticated;

create or replace function public.close_privacy_request(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  update public.privacy_requests
  set status = 'closed', closed_at = now()
  where id = target and status = 'open';
end;
$$;

revoke all on function public.close_privacy_request(uuid) from public, anon;
grant execute on function public.close_privacy_request(uuid) to authenticated;

alter table public.admin_notifications drop constraint admin_notifications_kind_check;
alter table public.admin_notifications add constraint admin_notifications_kind_check
  check (kind in ('signup', 'bug_report', 'approved', 'privacy_request'));

create or replace function public.enqueue_privacy_request_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_notifications (kind, payload)
  values (
    'privacy_request',
    jsonb_build_object(
      'request_id', new.id,
      'request_kind', new.kind,
      'email', new.email,
      'excerpt', left(new.message, 300)
    )
  );

  return new;
exception
  when others then
    return new;
end;
$$;

revoke all on function public.enqueue_privacy_request_notification() from public, anon, authenticated;

create trigger privacy_requests_notify_admins
  after insert on public.privacy_requests
  for each row execute function public.enqueue_privacy_request_notification();

create or replace function public.purge_diagnostics()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.bug_reports
  where status = 'resolved'
    and coalesce(resolved_at, created_at) < now() - interval '3 months';

  delete from public.bug_reports
  where status = 'open'
    and created_at < now() - interval '6 months';

  delete from public.client_errors
  where last_seen_at < now() - interval '3 months';

  delete from public.privacy_requests
  where status = 'closed'
    and closed_at < now() - interval '3 years';
end;
$$;

revoke all on function public.purge_diagnostics() from public, anon, authenticated;
