-- A Google Places API key, brought by whoever wants sharper shop search than Nominatim gives for free (#your
-- own key, same shape as ai_credentials and image_bank_credentials: one account, one key, nobody else's
-- business).

create table public.place_credentials (
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('google_places')),
  api_key text not null check (length(api_key) between 1 and 512),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.place_credentials enable row level security;

create policy place_credentials_own on public.place_credentials for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.place_credentials to authenticated;
