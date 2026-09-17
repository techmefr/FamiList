-- The shop the household did not create itself.
--
-- A layout always belongs to a shop: `shop_layouts` has (shop_id, user_id) as its primary key and a foreign
-- key to `shops`. A household with no shop therefore had nowhere to write the order of its aisles, and the
-- arrows as well as drag-and-drop did nothing at all, without the slightest message. Every household now
-- receives an empty shop on its first opening, which gives tidying somewhere to live from the start.
--
-- The first real shop replaces it rather than being added next to it: the tidying already done changes name,
-- it is not lost. This flag says which one is replaceable.
alter table public.shops
	add column if not exists is_default boolean not null default false;

-- A single default shop per household. The constraint is here and not only in the code: two devices opening
-- the application at the same time on a fresh household would both try to create it. The identifier is
-- already derived from the household so that both writes aim at the same row; this index is the belt, just in
-- case.
create unique index if not exists shops_one_default_per_household
	on public.shops (household_id)
	where is_default;
