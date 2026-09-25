-- Every insert, update and delete-attempt on a loyalty card, kept seven days: soft-delete stops a card from
-- being erased, but it does not say who touched it or when — the very question this incident raised. Seven
-- days is enough to catch a sync bug or a mistake in time to act on it, short enough that this table never
-- becomes its own thing to worry about.

create table public.loyalty_card_audit_log (
  id bigint generated always as identity primary key,
  card_id uuid not null,
  household_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index loyalty_card_audit_log_card_idx on public.loyalty_card_audit_log (card_id, created_at desc);
create index loyalty_card_audit_log_created_idx on public.loyalty_card_audit_log (created_at);

alter table public.loyalty_card_audit_log enable row level security;

-- Read-only for a household member, on their own card's history — nobody writes here directly, only the
-- trigger below (security definer, bypasses RLS).
create policy loyalty_card_audit_log_select on public.loyalty_card_audit_log for select
  using (household_id is not null and public.is_household_member(household_id));

revoke all on table public.loyalty_card_audit_log from public, anon, authenticated;
grant select on public.loyalty_card_audit_log to authenticated;

create or replace function public.log_loyalty_card_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.loyalty_card_audit_log (card_id, household_id, action, actor, before, after)
  values (
    coalesce(new.id, old.id),
    coalesce(new.household_id, old.household_id),
    lower(tg_op),
    auth.uid(),
    case when tg_op in ('update', 'delete') then to_jsonb(old) else null end,
    case when tg_op in ('update', 'insert') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.log_loyalty_card_change() from public, anon, authenticated;

drop trigger if exists loyalty_cards_audit on public.loyalty_cards;

create trigger loyalty_cards_audit
after insert or update or delete on public.loyalty_cards
for each row
execute function public.log_loyalty_card_change();

-- The audit trail keeps a soft-deleted card's story for a week; the card row itself, unresolved trash after a
-- month, is dead weight nobody is coming back for — anyone still wanting it has had four weeks of a visible
-- "recently deleted" support path to say so.
create or replace function public.purge_loyalty_card_audit_log()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.loyalty_card_audit_log where created_at < now() - interval '7 days';
  delete from public.loyalty_cards where deleted_at is not null and deleted_at < now() - interval '1 month';
$$;

revoke all on function public.purge_loyalty_card_audit_log() from public, anon, authenticated;

create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('familist-purge-loyalty-card-audit-log')
  where exists (select 1 from cron.job where jobname = 'familist-purge-loyalty-card-audit-log');

  perform cron.schedule(
    'familist-purge-loyalty-card-audit-log',
    '23 3 * * *',
    $cron$select public.purge_loyalty_card_audit_log()$cron$
  );
end;
$$;
