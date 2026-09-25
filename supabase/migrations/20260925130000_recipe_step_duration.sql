-- How long a step takes (#310), so cook-along can offer a timer on it. Null for a step with no wait,
-- which is most of them. Capped at a day: beyond that it is a marinade to plan, not a timer to watch.
alter table public.recipe_steps
  add column duration_seconds integer
    check (duration_seconds is null or (duration_seconds > 0 and duration_seconds <= 86400));
