-- A recipe's optional generated photo (#186).
--
-- What is stored here, and what is not. `recipes` gets a single reference column, not the image itself:
-- base64 in a column would be read again on every household member's sync, for a picture most syncs never
-- display. The pixels live in Supabase Storage, in a private bucket, and the row only remembers where.
--
-- The path convention below, `<household_id>/<recipe_id>`, is what lets the storage policies reuse the
-- household's own access rule instead of inventing a second one: the first path segment is read back out of
-- the object name and checked with the same `is_household_member` already governing every other household
-- table (see 20260908150000_list_access.sql and 20260914130000_recipes.sql).
alter table public.recipes
  add column photo_path text;

insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', false)
on conflict (id) do nothing;

-- The household a storage object belongs to, read out of its own path rather than joined from a table: an
-- object can outlive the moment its row is fetched, and the path is the only thing a storage policy is
-- handed.
create or replace function public.household_of_recipe_photo(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid
$$;

-- Same scope as recipes_all: belonging to the household means reading and writing its recipes' photos, no
-- narrower and no wider.
create policy recipe_photos_all on storage.objects for all
  using (
    bucket_id = 'recipe-photos'
    and public.is_household_member(public.household_of_recipe_photo(name))
  )
  with check (
    bucket_id = 'recipe-photos'
    and public.is_household_member(public.household_of_recipe_photo(name))
  );

grant execute on function public.household_of_recipe_photo(text) to authenticated;
