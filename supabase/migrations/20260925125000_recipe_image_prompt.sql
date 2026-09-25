-- The English description a generated dish photo is drawn from (#306).
--
-- The AI writes it alongside the recipe it drafts, or on demand the first time a photo is generated for a
-- recipe typed by hand. Keeping it on the row means a second try, or another household member, sends the
-- same description instead of paying for a new one. It is capped so a runaway answer cannot bloat every
-- member's sync.
alter table public.recipes
  add column image_prompt text
  check (image_prompt is null or char_length(image_prompt) <= 1000);
