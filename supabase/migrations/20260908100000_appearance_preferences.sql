-- Appearance preferences follow the person, not the device.
--
-- Until now `theme` and `type_scale` existed in the database but were neither read nor written: everything
-- lived in localStorage. Somebody who had set "Comfort" on their phone started from scratch on the tablet —
-- exactly the person for whom that setting matters most.
--
-- `type_scale` accepted only three values while the application offers seven. We remap the existing ones onto
-- the nearest notches before widening the constraint.

alter table public.profiles drop constraint if exists profiles_type_scale_check;

update public.profiles set type_scale = case type_scale
  when 'compact' then 'xs'
  when 'normal' then 'sm'
  when 'large' then 'lg'
  else 'sm'
end;

alter table public.profiles alter column type_scale set default 'sm';

alter table public.profiles add constraint profiles_type_scale_check
  check (type_scale in ('xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'comfort'));

-- The theme's default value becomes "system": following the device is the right starting point, and it is
-- already what the client does when no preference is stored.
alter table public.profiles alter column theme set default 'system';

alter table public.profiles
  add column accent_id text not null default 'terracotta'
    check (accent_id in ('terracotta', 'forest', 'blue', 'plum', 'teal', 'ink')),
  add column font_id text not null default 'system'
    check (font_id in ('system', 'atkinson', 'grotesk')),
  add column motion text not null default 'system'
    check (motion in ('system', 'full', 'none')),
  add column sound boolean not null default true,
  add column haptics boolean not null default true,
  add column has_seen_tour boolean not null default false;

-- Without this line, the writes would go off with no visible error and change nothing: privileges on profiles
-- are granted column by column since the approval migration, so that nobody can promote themselves to
-- administrator by modifying their own profile.
grant update (
  display_name,
  initial,
  tint,
  theme,
  type_scale,
  accent_id,
  font_id,
  motion,
  sound,
  haptics,
  has_seen_tour
) on public.profiles to authenticated;
