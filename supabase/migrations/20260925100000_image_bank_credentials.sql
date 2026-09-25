-- The free image banks' API keys each person brings (#305), kept apart from `ai_credentials`.
--
-- Same rules as `ai_credentials`, for the same reason: a key belongs to one account. No `household_id`
-- column, no `is_household_member` clause, no `is_admin` clause, and no realtime publication.
--
-- The provider list is closed because it decides which address the browser calls. Only banks whose API
-- answers a browser origin and whose terms allow storing the downloaded picture are listed. Unsplash is
-- left out on purpose: its API terms require hotlinking their own URLs, and this app copies the picture
-- into its `recipe-photos` bucket.
create table public.image_bank_credentials (
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('pexels', 'pixabay')),
  api_key text not null check (length(api_key) between 1 and 512),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.image_bank_credentials enable row level security;

create policy image_bank_credentials_own on public.image_bank_credentials for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.image_bank_credentials to authenticated;
