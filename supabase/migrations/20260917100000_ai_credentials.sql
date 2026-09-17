-- The artificial-intelligence API key each person brings, and nobody else.
--
-- This table is the schema's exception, and that is its whole point. Everywhere else here, belonging to the
-- household means reading and writing: lists, items, recipes, shops, loyalty cards, everything is shared by
-- `is_household_member`. The reflex, when adding a table, is therefore to attach it to a household. That
-- would be wrong here. An API key is a means of payment: it commits one person's quota and bill. Sharing it
-- with the household would be letting a teenager empty their mother's credit without her knowing.
--
-- Three holes have already been found in this area (#15, #16, #17). The two mistakes not to make are named
-- here so that a review can check that they are absent:
--
--   1. No `is_household_member` clause. The household has nothing to do with this table, and it deliberately
--      carries no `household_id` column — a column that does not exist cannot be joined by mistake in a
--      policy written six months later.
--   2. No `is_admin` clause. It is the most counter-intuitive point: `profiles_select` lets the
--      administrator read every profile, and copying that pattern here would give the instance's owner their
--      relatives' payment key. An administrator administers accounts, they do not inherit their means of
--      payment. That is also why the key does not live in a `profiles` column: it would be readable there by
--      that policy.
--
-- One row per account, hence `user_id` as the primary key rather than a separate `id`: nobody needs two
-- providers at once, and the primary key makes duplicates impossible with no extra constraint.
create table public.ai_credentials (
  user_id uuid primary key references auth.users on delete cascade,
  -- The list is closed on the database side because it determines the address the browser calls. It contains
  -- only providers verified to answer a request of browser origin, CORS headers included on the response
  -- itself and not only on the preflight. OpenAI is absent from it for that precise reason: its preflight
  -- passes, but its responses do not carry `access-control-allow-origin`, so the browser refuses to read
  -- them.
  provider text not null check (
    provider in ('anthropic', 'gemini', 'mistral', 'groq', 'openrouter', 'deepseek')
  ),
  api_key text not null check (length(api_key) between 1 and 512),
  -- The model is free: names change faster than migrations, and a constraint here would make the application
  -- unusable the day a provider renames its range. Empty = the one the client offers by default for this
  -- provider.
  model text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_credentials enable row level security;

-- A single policy, for every command, with the same condition on both sides. `for all` rather than four
-- separate policies: four places to write the same condition is four chances to forget one, and that is
-- exactly how holes of this kind are born.
--
-- `(select auth.uid())` and not `auth.uid()`: it is the form kept everywhere in this schema, it lets the
-- planner evaluate the call once for the query instead of once per row.
create policy ai_credentials_own on public.ai_credentials for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.ai_credentials to authenticated;

-- No realtime publication on this table, and that is intentional. The household's tables are all added to it
-- so that two phones stay in agreement; here there is nothing to agree on — a key concerns only one account —
-- and broadcasting it over a websocket channel would make the secret travel once more for no purpose
-- whatsoever.

-- Knowing who has a key without ever reading which.
--
-- The recipes screen must be able to ask "do I offer the suggestion" without the answer making the secret
-- travel. The question concerns only the calling account, so this function discloses nothing more than the
-- policy already allows; it simply avoids bringing the key down into the page to answer a boolean.
create or replace function public.has_ai_credential()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ai_credentials c where c.user_id = (select auth.uid())
  )
$$;

revoke all on function public.has_ai_credential() from public;
grant execute on function public.has_ai_credential() to authenticated;
