-- Tells the person their account was approved, through the same buffer as the admin's own notifications.
--
-- Why the existing table and not a second one. `admin_notifications` already carries a buffer, a claim
-- function, a cron wake-up and the Vault secrets that reach `notify-admins` — every piece an "approved" event
-- needs too, except the recipient, which here is the account itself rather than the admin list. Reusing the
-- table keeps that machinery in one place; only `notify-admins` learns to route a kind it did not know.

create or replace function public.enqueue_approval_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'approved' or old.status = 'approved' then
    return new;
  end if;

  insert into public.admin_notifications (kind, payload)
  values (
    'approved',
    jsonb_build_object(
      'profile_id', new.id,
      'display_name', new.display_name,
      'email', (select u.email::text from auth.users u where u.id = new.id)
    )
  );

  return new;
exception
  when others then
    -- Same rule as the sign-up trigger: an approval is never rolled back over an email that could not be
    -- queued.
    return new;
end;
$$;

create trigger profiles_notify_approval
  after update on public.profiles
  for each row execute function public.enqueue_approval_notification();

alter table public.admin_notifications drop constraint admin_notifications_kind_check;
alter table public.admin_notifications add constraint admin_notifications_kind_check
  check (kind in ('signup', 'bug_report', 'approved'));
