-- Les recettes : ce qu'on cuisine, et de quoi on en tire une liste de courses.
--
-- Attention au faux ami deja present dans cette base : poll_options.ingredients est un text[] qui
-- dit « ce que je ramene » pour un repas partage. Ce n'est pas une recette, ce n'est pas
-- reutilise ici, et c'est pour cela que les colonnes ci-dessous vivent dans leurs propres tables.
--
-- Pourquoi trois tables et non un jsonb. Un ingredient a une quantite, une unite et un rang ;
-- l'unite doit parler le meme langage que items.unit pour que la generation ne traduise rien, et
-- la quantite doit etre un nombre pour pouvoir etre mise a l'echelle du nombre de convives. Un
-- document json rendrait ces trois contraintes invisibles au moteur et laisserait passer
-- « 2 cuillieres » dans une colonne cense porter un nombre.
--
-- Pourquoi household_id sur la recette. Un foyer n'est ici qu'un cercle de partage (#101) : le
-- rattachement dit avec qui la recette est partagee, pas a qui elle appartient. La cle primaire de
-- household_members est deja (household_id, user_id), donc un compte membre de plusieurs foyers
-- voit les recettes de chacun quand il s'y place, sans qu'aucune recette ne soit dupliquee ni
-- qu'un compte soit enferme dans un foyer unique. Le jour ou une recette devra rester personnelle,
-- c'est une table recipe_members qui s'ajoutera a cote, comme list_members l'a fait pour les
-- listes : le present schema ne s'y oppose pas.
--
-- Pourquoi aucun lien entre une recette et la liste qu'elle a produite. La generation copie, elle
-- ne lie pas. Un article est consommable — on le coche, on le renomme devant le rayon, on le
-- supprime — alors qu'une recette se relit des mois plus tard : un lien vivant ferait qu'ecrire
-- « 300 g » au lieu de « 250 g » dans la recette reecrirait une course en train de se faire, et
-- que supprimer la recette viderait la liste. Le seul precedent de la base, pushIngredients, copie
-- lui aussi.
create table public.recipes (
  id uuid primary key default extensions.uuid_generate_v4(),
  household_id uuid not null references public.households on delete cascade,
  created_by uuid references auth.users on delete set null,
  name text not null,
  emoji text not null default '🍲',
  -- Le nombre de parts pour lequel les quantites sont ecrites. C'est le denominateur de la mise a
  -- l'echelle : sans lui, « 400 g de pates » ne dit pas pour combien de personnes.
  servings integer not null default 4 check (servings between 1 and 99),
  notes text,
  created_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default extensions.uuid_generate_v4(),
  recipe_id uuid not null references public.recipes on delete cascade,
  name text not null,
  -- Nullable et non zero : « du sel » n'a pas de quantite, et zero gramme de sel serait un
  -- mensonge que la mise a l'echelle propagerait. numeric comme items.qty, trois decimales pour
  -- que le tiers d'une recette pour six reste representable.
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

-- On lit toujours les enfants d'une recette entiere, dans l'ordre d'ecriture.
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);
create index recipe_steps_recipe_idx on public.recipe_steps (recipe_id, position);
create index recipes_household_idx on public.recipes (household_id);

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;

-- Les deux tables filles ne portent pas de foyer : elles le tiennent de leur recette. La fonction
-- est security definer pour la meme raison que can_access_list — elle est appelee depuis les
-- policies des tables filles et doit lire recipes sans repasser par la policy de recipes, qui
-- sinon se rappellerait elle-meme.
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

-- Comme toutes les tables du foyer : appartenir au cercle, c'est y lire et y ecrire. Le partage
-- entre membres demande par l'issue ne demande donc aucun geste — il est la regle de depart.
create policy recipes_all on public.recipes for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy recipe_ingredients_all on public.recipe_ingredients for all
  using (public.can_access_recipe(recipe_id))
  with check (public.can_access_recipe(recipe_id));

create policy recipe_steps_all on public.recipe_steps for all
  using (public.can_access_recipe(recipe_id))
  with check (public.can_access_recipe(recipe_id));

-- Les droits par defaut du schema couvrent deja les tables creees ensuite ; on les redit ici pour
-- que la migration se suffise a elle-meme si ces defauts changent un jour.
grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update, delete on public.recipe_ingredients to authenticated;
grant select, insert, update, delete on public.recipe_steps to authenticated;
grant execute on function public.can_access_recipe(uuid) to authenticated;

-- Une recette ecrite sur un telephone doit apparaitre sur celui d'a cote, comme les articles.
alter publication supabase_realtime add table public.recipes;
alter publication supabase_realtime add table public.recipe_ingredients;
alter publication supabase_realtime add table public.recipe_steps;
