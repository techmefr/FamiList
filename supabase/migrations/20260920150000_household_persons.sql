-- People a household needs to plan around, whether or not they hold an account.
--
-- household_members.user_id is a hard, not-null FK to auth.users: it exists to say who may sign in and act
-- in the household, so it cannot carry a child or a guest who never will. household_persons is the household's
-- roster of people instead of accounts: an adult already in household_members can also appear here (via
-- linked_user_id) so their allergy is not a second, disconnected entity, and a child or guest can appear here
-- with no account at all.
--
-- Why dietary_notes is free text and not tags. Same reasoning as recipes.notes: an allergy is written and
-- read by humans ("noix, un peu de lactose mais le fromage ca va"), not matched by a query today. A
-- structured tag table can be added later without migrating this column if generation ever needs to filter
-- on it; free text does not stand in the way.
create table public.household_persons (
  id uuid primary key default extensions.uuid_generate_v4(),
  household_id uuid not null references public.households on delete cascade,
  name text not null,
  -- The account that entered this person, not the person themselves: a parent adding a child, or a member
  -- noting a guest. Set null on delete so removing that account does not erase the household's roster.
  created_by uuid references auth.users on delete set null,
  -- Set when this row IS an existing account-holding member, so their dietary notes live in one place.
  linked_user_id uuid references auth.users on delete set null,
  dietary_notes text,
  created_at timestamptz not null default now()
);

create index household_persons_household_idx on public.household_persons (household_id);

alter table public.household_persons enable row level security;

-- Like recipes: belonging to the circle means reading and writing its people list.
create policy household_persons_all on public.household_persons for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

grant select, insert, update, delete on public.household_persons to authenticated;

alter publication supabase_realtime add table public.household_persons;
