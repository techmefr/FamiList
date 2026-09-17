-- The price of a product, noted in a shop, on a date.
--
-- Nothing kept track of what we pay. The expected value is simple and fits in one sentence: knowing that this
-- product costs less over there than here. It is a comparison between shops, not a curve: the table keeps the
-- full history because a reading goes stale, but the screen only shows each shop's last known price.
--
-- There is no product catalogue: items are typed by hand, list after list. What identifies "the same product"
-- from one week to the next is therefore the slug of its name, the one public.slugify() already produces for
-- the generated column items.product_slug and for the order learnt in shop_item_orders. We deliberately do
-- not point at items.id: an item is consumable, it disappears with its list, whereas the price must outlive
-- the shopping trip.
--
-- The name is kept beside the slug because a slug is not displayable, and because it cannot be traced back to
-- the original name.
--
-- The currency is carried by each row and not by the household: the application reads in ten languages, a
-- price noted while travelling must keep its own, and the display goes through Intl.NumberFormat on the
-- client side. numeric(12, 2) and not an integer number of cents: the items.qty column is already numeric,
-- and two representations of the same kind of number in the same database end up being confused sooner or
-- later.
--
-- recorded_at is written by the client and not defaulted to now(): the application is offline first, and a
-- price entered in a shop with no network sometimes leaves several hours later. The time of the reading is
-- the shop's, not the synchronisation's.
create table public.item_prices (
  id uuid primary key default extensions.uuid_generate_v4(),
  household_id uuid not null references public.households on delete cascade,
  shop_id uuid not null references public.shops on delete cascade,
  product_slug text not null,
  product_name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

-- The history screen always starts from the household, then from a product: that is the index's order.
create index item_prices_lookup_idx
  on public.item_prices (household_id, product_slug, shop_id, recorded_at desc);

alter table public.item_prices enable row level security;

-- Like every household table. The double condition is not redundant: the shop already carries its household,
-- and without it a row could attach the price to a shop from somewhere else.
create policy item_prices_all on public.item_prices for all
  using (public.is_household_member(household_id) and public.can_access_shop(shop_id))
  with check (public.is_household_member(household_id) and public.can_access_shop(shop_id));

-- The schema's default privileges already cover tables created afterwards; we say it again here so that the
-- table stands on its own if those defaults change one day.
grant select, insert, update, delete on public.item_prices to authenticated;

-- One person notes a price while the other finishes the list: the history screen must see it without waiting
-- for the next opening, like the items.
alter publication supabase_realtime add table public.item_prices;
