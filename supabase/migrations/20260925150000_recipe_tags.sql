-- Recipe tags (#314): course, diet, occasion, season, several per recipe, for the filters and browsing.
--
-- An array of stable keys on the recipe rather than a tag table and a join table: the list is fixed and
-- lives in the app (`src/lib/domain/recipe-tags.ts`, labels in the locale files), so there is no row a tag
-- would own. Being a column of `recipes`, it reads and writes under the recipe's own policies
-- (`recipes_select`, `recipes_write`, `recipes_update`, `recipes_delete`) and table grants: a shared recipe
-- shows its tags to the circles it is shared with, and only its household changes them.
--
-- The check holds the shape of a key, not the list: adding a tag is then an app release, not a migration,
-- and an older app never gets a recipe refused because a newer one tagged it. The cap keeps a runaway
-- write from bloating every member's sync. The pattern runs on the array's text form, where an element
-- holding anything but a key (a comma, a space, an empty string, a null) comes out quoted and fails.
alter table public.recipes
  add column tags text[] not null default '{}'
  check (
    cardinality(tags) <= 40
    and tags::text ~ '^\{([a-z][a-z_]*(,[a-z][a-z_]*)*)?\}$'
  );
