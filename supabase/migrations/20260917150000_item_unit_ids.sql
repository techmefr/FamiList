-- items.unit stores an id, not a word.
--
-- The column was created with "default 'pièce'", from a time when the field was free text and what was
-- typed was shown as is. Since then the unit is a stable id that the interface translates: an item created
-- today landed on the French word while the one next to it, saved through the dropdown, was 'piece' and
-- read in the ten languages. The table created later for recipe ingredients already defaults to 'piece' —
-- this one had not followed.
--
-- The client already knew how to read the old values: resolveUnit() maps 'pièce', 'boîte', 'sachet' and the
-- rest onto their id before display. So nothing was visibly broken, and that is exactly why it lasted. The
-- same mapping is applied here once, so that the same unit stops being written two ways depending on the
-- day a row was created.
--
-- Only the spellings that mapping already recognises are rewritten. Anything else — a unit somebody
-- invented, an import gone astray — is left alone: it is that person's own text, and the screen shows it
-- back as it is rather than replacing it with an approximation.

alter table public.items alter column unit set default 'piece';

with aliases (typed, id) as (
  values
    ('pièce', 'piece'), ('pièces', 'piece'), ('pieces', 'piece'), ('pce', 'piece'), ('pcs', 'piece'),
    ('unité', 'piece'), ('unit', 'piece'),
    ('gr', 'g'), ('gramme', 'g'), ('grammes', 'g'),
    ('kilo', 'kg'), ('kilos', 'kg'), ('kilogramme', 'kg'),
    ('litre', 'l'), ('litres', 'l'),
    ('paquet', 'pack'), ('paquets', 'pack'),
    ('boîte', 'box'), ('boîtes', 'box'), ('boxes', 'box'),
    ('bouteille', 'bottle'), ('bouteilles', 'bottle'),
    ('pot', 'jar'), ('pots', 'jar'),
    ('sachet', 'bag'), ('sachets', 'bag'),
    ('botte', 'bunch'), ('bottes', 'bunch'),
    ('tranche', 'slice'), ('tranches', 'slice'),
    ('barquette', 'tray'), ('barquettes', 'tray'),
    ('rouleau', 'roll'), ('rouleaux', 'roll'),
    ('brique', 'brick'), ('briques', 'brick')
)
update public.items as i
set unit = aliases.id
from aliases
where lower(btrim(i.unit)) = aliases.typed
  and i.unit <> aliases.id;
