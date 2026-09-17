-- First name, last name, and displayed name.
--
-- The profile had only a `display_name`, and the badge's initials were guessed by cutting up that string.
-- That works for "Helene Moreau", not for "Granny": a one-word nickname gives only one letter when the person
-- does have a first and a last name.
--
-- Both columns arrive empty and stay so as long as nobody fills them: sign-up does not ask for them, it keeps
-- its single field. `display_name` therefore stays the only reliable source of the displayed name, and the
-- only compulsory field.

alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '';

-- Privileges on profiles are granted column by column since the approval migration: without this line, the
-- write would go off with no visible error and change nothing.
grant update (first_name, last_name) on public.profiles to authenticated;

-- The household reads the two new columns just as it reads the name: that is where a member's initials come
-- from, and they must be right for everybody, not only for oneself. The read policy stays narrow — only the
-- columns the household needs come out of here.
drop function if exists public.household_profiles();

create function public.household_profiles()
returns table (
  id uuid,
  display_name text,
  first_name text,
  last_name text,
  initial text,
  avatar text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.first_name, p.last_name, p.initial, p.avatar
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
