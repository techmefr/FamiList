create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists unaccent with schema extensions;

create or replace function public.slugify(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select trim(both '-' from
    regexp_replace(
      lower(extensions.unaccent('extensions.unaccent'::regdictionary, value)),
      '[^a-z0-9]+', '-', 'g'
    )
  )
$$;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  initial text not null default '',
  tint text not null default '#C8532A',
  theme text not null default 'light' check (theme in ('light', 'dark', 'system')),
  type_scale text not null default 'normal' check (type_scale in ('compact', 'normal', 'large')),
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  created_by uuid not null references auth.users on delete restrict,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member',
  tint text not null default '#C8532A',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.shops (
  id uuid primary key default extensions.uuid_generate_v4(),
  household_id uuid not null references public.households on delete cascade,
  name text not null,
  short text not null default '',
  tint text not null default '#5A4A2F',
  created_at timestamptz not null default now()
);

create table public.aisles (
  id uuid primary key default extensions.uuid_generate_v4(),
  household_id uuid not null references public.households on delete cascade,
  name text not null,
  emoji text not null default '🛒',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.lists (
  id uuid primary key default extensions.uuid_generate_v4(),
  household_id uuid not null references public.households on delete cascade,
  name text not null,
  emoji text not null default '🛒',
  color text not null default '#C8532A',
  event_date text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.list_members (
  list_id uuid not null references public.lists on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  primary key (list_id, user_id)
);

create table public.items (
  id uuid primary key default extensions.uuid_generate_v4(),
  list_id uuid not null references public.lists on delete cascade,
  aisle_id uuid references public.aisles on delete set null,
  name text not null,
  product_slug text generated always as (public.slugify(name)) stored,
  qty numeric,
  unit text not null default 'pièce',
  checked boolean not null default false,
  priority boolean not null default false,
  note text,
  assigned_to uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_list_aisle_idx on public.items (list_id, aisle_id);
create index items_slug_idx on public.items (product_slug);

create table public.loyalty_cards (
  id uuid primary key default extensions.uuid_generate_v4(),
  household_id uuid not null references public.households on delete cascade,
  shop_id uuid references public.shops on delete set null,
  name text not null,
  num text not null default '',
  code text not null,
  code_type text not null check (code_type in ('code_39', 'ean_13', 'qr_code')),
  points int not null default 0,
  tint text not null default '#5A4A2F',
  grad text not null default '',
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.loyalty_cards is
  'Aucun secret ici. Les mots de passe de comptes fidelite restent en stockage securise sur l''appareil, jamais synchronises. Le champ notes est libre et visible par tout le foyer.';

create table public.shop_layouts (
  shop_id uuid not null references public.shops on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  aisle_order uuid[] not null default '{}',
  learned boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create table public.shop_item_orders (
  shop_id uuid not null references public.shops on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  aisle_id uuid not null references public.aisles on delete cascade,
  product_slugs text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (shop_id, user_id, aisle_id)
);

create table public.messages (
  id uuid primary key default extensions.uuid_generate_v4(),
  list_id uuid not null references public.lists on delete cascade,
  user_id uuid references auth.users on delete set null,
  body text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_list_created_idx on public.messages (list_id, created_at);

create table public.polls (
  id uuid primary key default extensions.uuid_generate_v4(),
  message_id uuid not null unique references public.messages on delete cascade,
  kind text not null check (kind in ('date', 'apport')),
  question text not null,
  closed boolean not null default false
);

create table public.poll_options (
  id uuid primary key default extensions.uuid_generate_v4(),
  poll_id uuid not null references public.polls on delete cascade,
  label text not null,
  emoji text,
  claimed_by uuid references auth.users on delete set null,
  ingredients text[] not null default '{}',
  position int not null default 0
);

create table public.poll_votes (
  option_id uuid not null references public.poll_options on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  primary key (option_id, user_id)
);

create or replace function public.is_household_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target and user_id = (select auth.uid())
  )
$$;

create or replace function public.can_access_list(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lists l
    join public.household_members m on m.household_id = l.household_id
    where l.id = target and m.user_id = (select auth.uid())
  )
$$;

create or replace function public.can_access_shop(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shops s
    join public.household_members m on m.household_id = s.household_id
    where s.id = target and m.user_id = (select auth.uid())
  )
$$;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.shops enable row level security;
alter table public.aisles enable row level security;
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.items enable row level security;
alter table public.loyalty_cards enable row level security;
alter table public.shop_layouts enable row level security;
alter table public.shop_item_orders enable row level security;
alter table public.messages enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

create policy profiles_select on public.profiles for select
  using (id = (select auth.uid()));
create policy profiles_upsert on public.profiles for insert
  with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy households_select on public.households for select
  using (public.is_household_member(id));
create policy households_insert on public.households for insert
  with check (created_by = (select auth.uid()));
create policy households_update on public.households for update
  using (public.is_household_member(id)) with check (public.is_household_member(id));

create policy household_members_select on public.household_members for select
  using (public.is_household_member(household_id));
create policy household_members_insert on public.household_members for insert
  with check (
    user_id = (select auth.uid())
    or public.is_household_member(household_id)
  );
create policy household_members_delete on public.household_members for delete
  using (public.is_household_member(household_id));

create policy shops_all on public.shops for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy aisles_all on public.aisles for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy lists_all on public.lists for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy list_members_all on public.list_members for all
  using (public.can_access_list(list_id))
  with check (public.can_access_list(list_id));

create policy items_all on public.items for all
  using (public.can_access_list(list_id))
  with check (public.can_access_list(list_id));

create policy loyalty_cards_all on public.loyalty_cards for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy shop_layouts_all on public.shop_layouts for all
  using (user_id = (select auth.uid()) and public.can_access_shop(shop_id))
  with check (user_id = (select auth.uid()) and public.can_access_shop(shop_id));

create policy shop_item_orders_all on public.shop_item_orders for all
  using (user_id = (select auth.uid()) and public.can_access_shop(shop_id))
  with check (user_id = (select auth.uid()) and public.can_access_shop(shop_id));

create policy messages_all on public.messages for all
  using (public.can_access_list(list_id))
  with check (public.can_access_list(list_id));

create policy polls_all on public.polls for all
  using (exists (select 1 from public.messages m where m.id = message_id and public.can_access_list(m.list_id)))
  with check (exists (select 1 from public.messages m where m.id = message_id and public.can_access_list(m.list_id)));

create policy poll_options_all on public.poll_options for all
  using (exists (
    select 1 from public.polls p join public.messages m on m.id = p.message_id
    where p.id = poll_id and public.can_access_list(m.list_id)))
  with check (exists (
    select 1 from public.polls p join public.messages m on m.id = p.message_id
    where p.id = poll_id and public.can_access_list(m.list_id)));

create policy poll_votes_select on public.poll_votes for select
  using (exists (
    select 1 from public.poll_options o join public.polls p on p.id = o.poll_id
    join public.messages m on m.id = p.message_id
    where o.id = option_id and public.can_access_list(m.list_id)));
create policy poll_votes_write on public.poll_votes for insert
  with check (user_id = (select auth.uid()));
create policy poll_votes_delete on public.poll_votes for delete
  using (user_id = (select auth.uid()));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();
create trigger shop_layouts_touch before update on public.shop_layouts
  for each row execute function public.touch_updated_at();
create trigger shop_item_orders_touch before update on public.shop_item_orders
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, initial)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data ->> 'display_name', new.email), 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.poll_options;
alter publication supabase_realtime add table public.poll_votes;
