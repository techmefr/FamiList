-- The same normalisation, for what was typed in English.
--
-- The previous migration mapped the French spellings of the free-text era onto their id. It left the
-- English ones, on the assumption that the field had only ever been filled in French — which is wrong for
-- an app that reads in ten languages, and wrong for anything that arrived through an import.
--
-- Same rule as before: only the spellings the client already recognises are rewritten, and the ids
-- themselves are not touched. Replayed on a database where the first pass has already run, this one
-- changes nothing — the two sets do not overlap.

with aliases (typed, id) as (
  values
    ('units', 'piece'), ('item', 'piece'), ('items', 'piece'),
    ('gram', 'g'), ('grams', 'g'),
    ('kilogram', 'kg'), ('kilograms', 'kg'),
    ('milliliter', 'ml'), ('milliliters', 'ml'), ('millilitre', 'ml'), ('millilitres', 'ml'),
    ('liter', 'l'), ('liters', 'l'),
    ('packs', 'pack'), ('packet', 'pack'), ('packets', 'pack'),
    ('bottles', 'bottle'),
    ('jars', 'jar'),
    ('bags', 'bag'),
    ('bunches', 'bunch'),
    ('slices', 'slice'),
    ('trays', 'tray'),
    ('rolls', 'roll'),
    ('bricks', 'brick')
)
update public.items as i
set unit = aliases.id
from aliases
where lower(btrim(i.unit)) = aliases.typed
  and i.unit <> aliases.id;
