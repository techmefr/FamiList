-- The household members' portrait.
--
-- A square 128 px thumbnail, stored as `data:` in the profile's row rather than in a file store. At that size
-- it weighs a handful of kilobytes: it travels with the rest of the household, with no second data path to
-- secure, and it stays readable offline. The length constraint is there so that this choice stays tenable —
-- beyond it, somebody is trying to store the original photograph in there.

alter table public.profiles
  add column if not exists avatar text not null default '';

alter table public.profiles
  drop constraint if exists profiles_avatar_size;

alter table public.profiles
  add constraint profiles_avatar_size check (length(avatar) <= 200000);

grant update (avatar) on public.profiles to authenticated;

-- The function now exposes the portrait, just as it does the name and the initials: the profiles read policy
-- stays narrow, only the columns the household needs come out of here.
drop function if exists public.household_profiles();

create function public.household_profiles()
returns table (id uuid, display_name text, initial text, avatar text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.initial, p.avatar
  from public.profiles p
  where public.is_approved()
    and exists (
      select 1
      from public.household_members mine
      join public.household_members theirs on theirs.household_id = mine.household_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = p.id
    )
$$;

revoke all on function public.household_profiles() from public;
grant execute on function public.household_profiles() to authenticated;
