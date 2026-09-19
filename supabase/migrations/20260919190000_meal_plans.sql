-- Meal plans: several recipes picked together, to generate one consolidated shopping list from all of
-- them instead of one list per recipe.
--
-- Why a new concept rather than reusing recipes or lists directly. A recipe answers "what do I cook" and
-- a list answers "what do I buy right now"; a meal plan answers a third question, "what am I cooking this
-- week", which needs its own row to be revisited and edited before the shopping list is generated. It is
-- the same household-scoping pattern as recipes (#101 sharing circle), copied verbatim.
--
-- Why meal_plan_recipes is its own table rather than a uuid[] on meal_plans. A recipe in a plan carries
-- two things of its own — the number of people it is scaled for here, and where it sits in the week — so
-- it needs a row, the same way recipe_ingredients needed its own table rather than a jsonb column on
-- recipes.
create table public.meal_plans (
  id uuid primary key default extensions.uuid_generate_v4(),
  household_id uuid not null references public.households on delete cascade,
  created_by uuid references auth.users on delete set null,
  -- Free text, not a computed week label: a plan is renamed as easily as a list, and a person planning two
  -- weeks ahead should not be fought by a label that assumes "this week".
  name text not null default 'Menu de la semaine',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meal_plan_recipes (
  id uuid primary key default extensions.uuid_generate_v4(),
  meal_plan_id uuid not null references public.meal_plans on delete cascade,
  -- A recipe removed from the household should not silently corrupt a plan's line: it disappears from it,
  -- like an item never keeps a dangling reference to a deleted aisle.
  recipe_id uuid not null references public.recipes on delete cascade,
  -- Mirrors generateList's own `people` parameter: how many this recipe is scaled for inside this plan,
  -- independently from the recipe's own `servings` and from every other recipe in the plan.
  people integer not null default 4 check (people between 1 and 99),
  -- Nullable: "ideally which day" (#210) is a nice-to-have, not a requirement. Null means unscheduled, and
  -- a plan of unscheduled recipes remains entirely usable — it is simply not laid out on a week grid.
  day_index integer check (day_index between 0 and 6),
  -- Ordering within a day (or within the unscheduled bucket), the same role `position` plays for
  -- recipe_ingredients and recipe_steps.
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index meal_plans_household_idx on public.meal_plans (household_id);
create index meal_plan_recipes_plan_idx on public.meal_plan_recipes (meal_plan_id, position);
create index meal_plan_recipes_recipe_idx on public.meal_plan_recipes (recipe_id);

alter table public.meal_plans enable row level security;
alter table public.meal_plan_recipes enable row level security;

-- Same trigger already used by items, shop_layouts and shop_item_orders: `updated_at` is maintained by the
-- database, not by every client remembering to set it.
create trigger meal_plans_touch before update on public.meal_plans
  for each row execute function public.touch_updated_at();

-- Same reasoning as can_access_recipe: meal_plan_recipes carries no household of its own, it takes it from
-- its plan, and the function is security definer so the child table's policy does not call back into
-- meal_plans's own policy.
create or replace function public.can_access_meal_plan(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.meal_plans p
    join public.household_members m on m.household_id = p.household_id
    where p.id = target and m.user_id = (select auth.uid())
  )
$$;

-- Like recipes: belonging to the circle means reading and writing in it, no separate sharing gesture.
create policy meal_plans_all on public.meal_plans for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy meal_plan_recipes_all on public.meal_plan_recipes for all
  using (public.can_access_meal_plan(meal_plan_id))
  with check (public.can_access_meal_plan(meal_plan_id));

grant select, insert, update, delete on public.meal_plans to authenticated;
grant select, insert, update, delete on public.meal_plan_recipes to authenticated;
grant execute on function public.can_access_meal_plan(uuid) to authenticated;

-- A plan built on one phone must appear on the one next to it, like recipes.
alter publication supabase_realtime add table public.meal_plans;
alter publication supabase_realtime add table public.meal_plan_recipes;
