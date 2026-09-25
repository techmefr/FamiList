-- Which ingredients each step uses (#308), so cook-along can show what to get out for the step at hand.
--
-- An array on the step rather than a join table: a recipe's lines and steps are always rewritten together
-- (`updateRecipe` deletes and re-inserts both), so the link never outlives the rows it points at for long,
-- and the step's own row already carries the recipe's access rule. No foreign key can live on array
-- elements; an id left over from a removed line is simply ignored when read.
alter table public.recipe_steps
  add column ingredient_ids uuid[] not null default '{}';
