-- Quitter un foyer efface aussi ses rangements de magasin.
--
-- leave_household_lists nettoie list_members au depart, mais shop_layouts et shop_item_orders
-- restaient : des lignes que la RLS rend inaccessibles, jamais supprimees, et qui reviendraient
-- telles quelles si la meme personne rejoignait le foyer plus tard.

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

-- Les lignes deja orphelines, laissees par les departs passes.
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
