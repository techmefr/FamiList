-- Offering the loyalty card when approaching a shop, or not at all.
--
-- The setting follows the person and not the device, like the rest of the preferences: somebody who has
-- refused to have their position followed on their phone does not have to refuse it a second time on the
-- tablet. It starts off false, unlike sound and vibration — letting a device follow your position is an
-- agreement you give, not a default you discover afterwards.
--
-- The system permission stays in charge: this boolean opens nothing on its own, it only says that the
-- monitoring is allowed to start when the device, for its part, permits it.
alter table public.profiles
  add column nearby_cards boolean not null default false;

-- Privileges on profiles are granted column by column since the approval migration: without this line the
-- write would go off with no visible error and change nothing.
grant update (nearby_cards) on public.profiles to authenticated;
