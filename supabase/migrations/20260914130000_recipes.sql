-- Recipes: what we cook, and what a shopping list is drawn from.
--
-- Beware the false friend already present in this database: poll_options.ingredients is a text[] saying
-- "what I am bringing" for a shared meal. It is not a recipe, it is not reused here, and that is why the
-- columns below live in their own tables.
--
-- Why three tables and not a jsonb. An ingredient has a quantity, a unit and a rank; the unit must speak the
-- same language as items.unit so that generation translates nothing, and the quantity must be a number so
-- that it can be scaled to the number of guests. A json document would make those three constraints
-- invisible to the engine and would let "2 spoonfuls" through in a column supposed to carry a number.
--
-- Why household_id on the recipe. A household is only a sharing circle here (#101): the attachment says who
-- the recipe is shared with, not who it belongs to. household_members's primary key is already
-- (household_id, user_id), so an account belonging to several households sees each one's recipes when it
-- moves there, with no recipe duplicated and no account locked into a single household. The day a recipe has
-- to stay personal, a recipe_members table will be added alongside, as list_members did for the lists: the
-- present schema does not stand in the way.
--
-- Why no link between a recipe and the list it produced. Generation copies, it does not link. An item is
-- consumable — it is ticked, renamed in front of the aisle, deleted — whereas a recipe is read again months
-- later: a live link would mean that writing "300 g" instead of "250 g" in the recipe would rewrite a
-- shopping trip in progress, and that deleting the recipe would empty the list. The database's only
-- precedent, pushIngredients, copies too.
create table public.recipes (
  id uuid primary key default extensions.uuid_generate_v4(),
  household_id uuid not null references public.households on delete cascade,
  created_by uuid references auth.users on delete set null,
  name text not null,
  emoji text not null default '🍲',
  -- The number of servings the quantities are written for. It is the denominator of the scaling: without it,
  -- "400 g of pasta" does not say for how many people.
  servings integer not null default 4 check (servings between 1 and 99),
  notes text,
  created_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default extensions.uuid_generate_v4(),
  recipe_id uuid not null references public.recipes on delete cascade,
  name text not null,
  -- Nullable and not zero: "some salt" has no quantity, and zero grams of salt would be a lie that scaling
  -- would propagate. numeric like items.qty, three decimals so that a third of a recipe for six stays
  -- representable.
  qty numeric(12, 3),
  unit text not null default 'piece',
  position integer not null default 0
);

create table public.recipe_steps (
  id uuid primary key default extensions.uuid_generate_v4(),
  recipe_id uuid not null references public.recipes on delete cascade,
  body text not null,
  position integer not null default 0
);

-- We always read a whole recipe's children, in writing order.
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);
create index recipe_steps_recipe_idx on public.recipe_steps (recipe_id, position);
create index recipes_household_idx on public.recipes (household_id);

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;

-- The two child tables carry no household: they take it from their recipe. The function is security definer
-- for the same reason as can_access_list — it is called from the child tables' policies and must read recipes
-- without going back through recipes's policy, which would otherwise call itself.
create or replace function public.can_access_recipe(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.recipes r
    join public.household_members m on m.household_id = r.household_id
    where r.id = target and m.user_id = (select auth.uid())
  )
$$;

-- Like every household table: belonging to the circle means reading and writing in it. The sharing between
-- members the issue asks for therefore takes no gesture — it is the starting rule.
create policy recipes_all on public.recipes for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy recipe_ingredients_all on public.recipe_ingredients for all
  using (public.can_access_recipe(recipe_id))
  with check (public.can_access_recipe(recipe_id));

create policy recipe_steps_all on public.recipe_steps for all
  using (public.can_access_recipe(recipe_id))
  with check (public.can_access_recipe(recipe_id));

-- The schema's default privileges already cover tables created afterwards; we say it again here so that the
-- migration stands on its own if those defaults change one day.
grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update, delete on public.recipe_ingredients to authenticated;
grant select, insert, update, delete on public.recipe_steps to authenticated;
grant execute on function public.can_access_recipe(uuid) to authenticated;

-- A recipe written on one phone must appear on the one next to it, like the items.
alter publication supabase_realtime add table public.recipes;
alter publication supabase_realtime add table public.recipe_ingredients;
alter publication supabase_realtime add table public.recipe_steps;
