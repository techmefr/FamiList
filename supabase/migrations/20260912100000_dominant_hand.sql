-- The dominant hand follows the person, like the other appearance preferences.
--
-- The create button sits at the bottom right, the place Android recommends because that is where a
-- right-hander's thumb lands. For a left-hander, it is the corner furthest from the hand: you have to change
-- your grip to add an item, a gesture repeated dozens of times while shopping, one hand on the trolley.
--
-- Right-handed by default, since that is the current placement: nobody sees their screen move.
--
-- This side is physical and not logical: it does not follow the reading direction, otherwise the setting
-- would be reversed in Arabic. The column therefore says "hand", not "start" or "end".

alter table public.profiles
  add column hand text not null default 'right'
    check (hand in ('right', 'left'));

-- Without this line, the write would go off with no visible error and change nothing: privileges on profiles
-- are granted column by column since the approval migration.
grant update (hand) on public.profiles to authenticated;
