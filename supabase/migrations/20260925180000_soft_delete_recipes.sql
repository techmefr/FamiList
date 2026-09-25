-- A recipe is shared the same way a loyalty card is (recipe_shares, household_id never reassigned) and so it
-- can be lost to the same class of bug: DELETE was reachable by any member of the owning household, with no
-- way back. Same remedy as loyalty_cards.

alter table public.recipes add column deleted_at timestamptz;

create policy recipes_hide_deleted on public.recipes as restrictive for select
  using (deleted_at is null);

revoke delete on public.recipes from authenticated;

-- A soft-deleted recipe's ingredients and steps must disappear from view along with it, not just the recipe
-- row itself — can_access_recipe is what both child tables' policies rely on.
create or replace function public.can_access_recipe(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.recipes r
    join public.household_members m on m.household_id = r.household_id
    where r.id = target and r.deleted_at is null and m.user_id = (select auth.uid())
  )
$$;

create table public.recipe_audit_log (
  id bigint generated always as identity primary key,
  recipe_id uuid not null,
  household_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index recipe_audit_log_recipe_idx on public.recipe_audit_log (recipe_id, created_at desc);
create index recipe_audit_log_created_idx on public.recipe_audit_log (created_at);

alter table public.recipe_audit_log enable row level security;

create policy recipe_audit_log_select on public.recipe_audit_log for select
  using (household_id is not null and public.is_household_member(household_id));

revoke all on table public.recipe_audit_log from public, anon, authenticated;
grant select on public.recipe_audit_log to authenticated;

create or replace function public.log_recipe_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.recipe_audit_log (recipe_id, household_id, action, actor, before, after)
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

revoke all on function public.log_recipe_change() from public, anon, authenticated;

drop trigger if exists recipes_audit on public.recipes;

create trigger recipes_audit
after insert or update or delete on public.recipes
for each row
execute function public.log_recipe_change();

create or replace function public.purge_recipe_audit_log()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.recipe_audit_log where created_at < now() - interval '7 days';
  delete from public.recipes where deleted_at is not null and deleted_at < now() - interval '1 month';
$$;

revoke all on function public.purge_recipe_audit_log() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('familist-purge-recipe-audit-log')
  where exists (select 1 from cron.job where jobname = 'familist-purge-recipe-audit-log');

  perform cron.schedule(
    'familist-purge-recipe-audit-log',
    '29 3 * * *',
    $cron$select public.purge_recipe_audit_log()$cron$
  );
end;
$$;
