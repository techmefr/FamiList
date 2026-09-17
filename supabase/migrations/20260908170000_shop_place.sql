-- A shop is a chain, a name, an address and a point on the map.
--
-- Until now the table carried only a name, in which everything was mixed together: "Carrefour Meximieux" said
-- the chain and the town without either being usable separately. Yet the three serve different purposes. The
-- chain carries the loyalty card, valid in any shop of that chain. The address tells two shops of the same
-- chain apart, and it is from it that the trigram's town is taken. The name stays what you read on the shop
-- front.
--
-- Everything is optional, and that is intended: a hairdresser or a local butcher has no chain, and a shop
-- whose address was never entered must go on working. The text columns therefore have an empty default value
-- rather than being nullable — it is what `short` already does, and it avoids having to handle the null on
-- every read.
--
-- The position, for its part, really is nullable: "not recorded yet" and "the point 0,0 off the coast of
-- Africa" are not the same thing. It is captured on the spot, by the button that reads the device's GPS — no
-- geocoding service is called, the address does not leave the phone.
alter table public.shops
	add column if not exists brand text not null default '',
	add column if not exists address text not null default '',
	add column if not exists lat double precision,
	add column if not exists lng double precision;

-- A card can belong to a chain rather than to a particular shop.
--
-- `shop_id` already existed but was never filled in from the screen: the card was attached to the shop by
-- comparing its name, which breaks as soon as either one is renamed. The attachment becomes explicit, and a
-- second way of attaching appears: by chain. That is the common case — a Carrefour card works in every
-- Carrefour, not only the one in Meximieux.
--
-- Both columns can be filled: the shop narrows, the chain generalises, and the arrival notification uses the
-- first that matches.
alter table public.loyalty_cards
	add column if not exists brand text not null default '';

-- Finding a chain's shops, to offer the card in the right place.
create index if not exists shops_household_brand_idx
	on public.shops (household_id, brand)
	where brand <> '';
