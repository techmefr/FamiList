-- Leaving a household also erases its shop layouts.
--
-- leave_household_lists cleans up list_members on departure, but shop_layouts and shop_item_orders stayed:
-- rows that RLS makes unreachable, never deleted, and that would come back as they were if the same person
-- rejoined the household later.

create or replace function public.leave_household_layouts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.shop_item_orders o
  using public.shops s
  where o.shop_id = s.id
    and s.household_id = old.household_id
    and o.user_id = old.user_id;

  delete from public.shop_layouts sl
  using public.shops s
  where sl.shop_id = s.id
    and s.household_id = old.household_id
    and sl.user_id = old.user_id;

  return old;
end;
$$;

drop trigger if exists household_members_leave_layouts on public.household_members;
create trigger household_members_leave_layouts after delete on public.household_members
  for each row execute function public.leave_household_layouts();

-- The rows already orphaned, left behind by past departures.
delete from public.shop_item_orders o
using public.shops s
where o.shop_id = s.id
  and not exists (
    select 1 from public.household_members m
    where m.household_id = s.household_id and m.user_id = o.user_id
  );

delete from public.shop_layouts sl
using public.shops s
where sl.shop_id = s.id
  and not exists (
    select 1 from public.household_members m
    where m.household_id = s.household_id and m.user_id = sl.user_id
  );
