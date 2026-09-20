-- One provider was enough until it was not: the account now needs to hold a key per provider, so that
-- hitting a free-tier rate limit on one no longer means deleting a key just to type another one back in
-- minutes later (#233). `user_id` stops being the primary key on its own; the pair `(user_id, provider)`
-- is the natural key for "this account's key for that provider", and it makes the same duplicate
-- impossible that the single-column key used to.
--
-- "Which one answers the call right now" still needs exactly one answer per account, so it is not left to
-- the client to guess from a list: `is_active` says it, and the partial unique index below is the same
-- guarantee the old primary key gave for "one row", now given for "one active row".
alter table public.ai_credentials drop constraint ai_credentials_pkey;
alter table public.ai_credentials add primary key (user_id, provider);

alter table public.ai_credentials add column is_active boolean not null default true;

-- At most one active provider per account. A plain unique constraint on `user_id` would forbid the second
-- row entirely; this one only forbids two rows both claiming to be the active one, which is the actual
-- rule.
create unique index ai_credentials_one_active on public.ai_credentials (user_id) where is_active;

-- Every row that existed before this migration was the account's only one, and it defaulted to
-- `is_active = true` on the column add above: nothing to backfill, nothing to dedup.

-- The RLS policy already compares `user_id` alone to `auth.uid()` (`ai_credentials_own`, in
-- 20260917100000_ai_credentials.sql) and never referenced the primary key's shape, so it needs no change:
-- an account still only ever sees and writes its own rows, one now per provider instead of one total.
