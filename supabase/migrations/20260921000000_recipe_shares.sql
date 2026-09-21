-- Sharing a recipe with another circle, without reassigning it.
--
-- A recipe already belongs to a household at creation (recipes.household_id is not null, unlike lists'
-- nullable personal case): a household is only a sharing circle here too (#101), but the owning household
-- must stay able to see and edit its own recipe after sharing it, which ShareSheet's model (reassigning
-- household_id once) cannot do without removing it from the original circle. This is a join table instead
-- — the household_members-style membership pattern already used throughout this schema, applied between a
-- recipe and a household rather than between a household and a person.
create table public.recipe_shares (
  recipe_id uuid not null references public.recipes on delete cascade,
  household_id uuid not null references public.households on delete cascade,
  shared_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  primary key (recipe_id, household_id)
);

create index recipe_shares_household_idx on public.recipe_shares (household_id);

alter table public.recipe_shares enable row level security;

-- Read access for can_access_recipe now widens to "owning household, or a household it was shared with" —
-- every table gated on it (recipes, recipe_ingredients, recipe_steps) picks up the change without touching
-- their own policies.
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
  ) or exists (
    select 1
    from public.recipe_shares s
    join public.household_members m on m.household_id = s.household_id
    where s.recipe_id = target and m.user_id = (select auth.uid())
  )
$$;

-- recipes itself is gated on is_household_member(household_id), the owning circle only — can_access_recipe
-- is not used there, so it must be told about sharing separately, or a member of a circle a recipe was
-- shared into could not even read the parent row their ingredients/steps already unlock.
drop policy recipes_all on public.recipes;
create policy recipes_select on public.recipes for select
  using (public.can_access_recipe(id));
create policy recipes_write on public.recipes for insert with check (public.is_household_member(household_id));
create policy recipes_update on public.recipes for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy recipes_delete on public.recipes for delete
  using (public.is_household_member(household_id));

-- Read: a member of either side. Write (share/unshare): only a member of the OWNING household — checked
-- against recipes.household_id, not against recipe_shares itself, so that a circle a recipe was merely
-- shared into cannot re-share it further without the owner's say.
create policy recipe_shares_select on public.recipe_shares for select
  using (public.can_access_recipe(recipe_id));

create policy recipe_shares_insert on public.recipe_shares for insert
  with check (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id and public.is_household_member(r.household_id)
    )
  );

create policy recipe_shares_delete on public.recipe_shares for delete
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_id and public.is_household_member(r.household_id)
    )
  );

grant select, insert, delete on public.recipe_shares to authenticated;
grant execute on function public.can_access_recipe(uuid) to authenticated;

alter publication supabase_realtime add table public.recipe_shares;
