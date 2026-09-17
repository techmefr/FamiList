-- Direct messages, outside any circle.
--
-- Until now a discussion only existed attached to a list: `messages.list_id` was not null, and the chat's
-- only entrance was `/l/[id]/chat`. The owner settled on three scopes for a conversation — the circle, the
-- event, and person to person. This migration delivers only the third, in full; the other two remain to be
-- done and nothing here prejudges them.
--
-- Why the third first: it is the one that fits no existing mould. A private message is private, so it
-- attaches to no household. That is not a convenience, it is the answer to a real ambiguity: with multiple
-- membership, two people often share several circles, and attaching their conversation to one of them would
-- be an arbitrary choice that would make it readable by that circle's other members. A direct conversation
-- therefore belongs to nobody but its two participants.
--
-- What that costs: `is_household_member` and `can_access_list`, the two guards the whole rest of the schema
-- leans on, no longer apply. There is no `household_id` to shelter behind. The RLS of this area has already
-- carried three holes (#15, #16, #17), plus two found while making `lists.household_id` nullable (#145); we
-- do not improvise here.
--
-- The choice that closes the subject: the two conversation tables carry NO write right. No insert, no
-- update, no delete for `authenticated` — explicitly revoked further down, because the schema's default
-- privileges grant them automatically to any new table. A direct conversation can therefore only be born
-- through `start_direct_conversation`, which creates it with its two participants in the same transaction.
-- In other words, the question "can somebody add themselves to an existing conversation?" is not played out
-- in a subtle policy: the verb is not granted. It is the only form of proof that holds on this area.
--
-- The pair is finally unique by construction, through a computed `pair` column: two people have only one
-- direct conversation, and a third cannot slip into it since the column describes only two accounts.

-- 1. The conversation.
--
-- `scope` takes only one value for now. The column is there because the settled model carries three and the
-- constraint will widen when the other two arrive; today it asserts only what is actually applied.
--
-- `pair` carries the two accounts sorted. It is what makes the pair's uniqueness checkable by the index
-- rather than by code, and what structurally forbids a three-way direct conversation.
create table public.conversations (
  id uuid primary key default extensions.uuid_generate_v4(),
  scope text not null check (scope in ('direct')),
  pair uuid[] not null,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  constraint conversations_pair_is_a_pair check (
    array_length(pair, 1) = 2 and pair[1] < pair[2]
  )
);

create unique index conversations_pair_idx on public.conversations (pair);

comment on table public.conversations is
  'Une conversation et sa portee. Aujourd hui uniquement la portee directe, qui ne se rattache a aucun foyer : un message prive est prive, et deux personnes membres de plusieurs cercles communs n auraient de toute facon pas de cercle evident a lui donner.';

comment on column public.conversations.pair is
  'Les deux comptes de la conversation directe, tries. Unique : une seule conversation par paire, et une troisieme personne ne peut pas y figurer.';

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  primary key (conversation_id, user_id)
);

-- We always read "my conversations", never "this one's participants" first.
create index conversation_participants_user_idx on public.conversation_participants (user_id);

-- 2. A message attaches to a list OR to a conversation, never to both nor to neither.
--
-- `list_id` becomes nullable, as `lists.household_id` did. The trap is the same and is handled the same way:
-- every policy that read `list_id` is rewritten explicitly further down, even those that did not need it,
-- with the reason written out. A null forgotten in a `where` either makes a message disappear or leaks it.
alter table public.messages alter column list_id drop not null;

alter table public.messages
  add column conversation_id uuid references public.conversations on delete cascade;

alter table public.messages
  add constraint messages_one_scope check (num_nonnulls(list_id, conversation_id) = 1);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

comment on column public.messages.conversation_id is
  'La conversation qui porte le message, ou null si le message appartient a une liste. Exactement une des deux colonnes est renseignee.';

-- 3. The guards.
--
-- security definer for the same reason as can_access_list: these functions are called from the policies of
-- the tables they read, and going back under RLS would make the policy loop.
create or replace function public.is_conversation_participant(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Approval is asked for again here as in is_household_member and can_access_list: a suspended account
  -- reads nothing any more, and a direct conversation is no exception.
  select public.is_approved() and exists (
    select 1
    from public.conversation_participants p
    where p.conversation_id = target and p.user_id = (select auth.uid())
  )
$$;

comment on function public.is_conversation_participant(uuid) is
  'Vrai si l appelant participe a la conversation. Seule garde d une conversation directe : elle n a aucun foyer, donc is_household_member ne s y applique pas.';

-- Access to a message, whatever its scope. A single place where the choice between the two columns is
-- written: the polls, which hang off the messages, plug into it instead of each redoing the test on their own
-- side and getting it wrong one day.
create or replace function public.can_access_message(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.messages m
    where m.id = target
      and case
        when m.list_id is not null then public.can_access_list(m.list_id)
        else public.is_conversation_participant(m.conversation_id)
      end
  )
$$;

comment on function public.can_access_message(uuid) is
  'Vrai si l appelant peut lire le message, par sa liste ou par sa conversation. Le case est exhaustif : la contrainte messages_one_scope garantit qu une des deux colonnes est renseignee.';

-- 4. The policies.
--
-- Read only on the two conversation tables, and nothing else: see the header. A conversation is read only if
-- you take part in it, and the participant list follows the conversation.
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;

create policy conversations_select on public.conversations for select
  using (public.is_conversation_participant(id));

create policy conversation_participants_select on public.conversation_participants for select
  using (public.is_conversation_participant(conversation_id));

-- The messages. The old policy called can_access_list(list_id) unconditionally; with a null list_id it
-- returned false, so no direct message would have been readable, not even by its two participants. It is
-- replaced, not completed, so that only one remains to read.
--
-- The with check adds what the old one did not demand on the direct scope: being the message's author. In a
-- two-person conversation, writing in the other's name is not a detail — and nothing in the rest of the
-- schema prevented it.
drop policy if exists messages_all on public.messages;

create policy messages_select on public.messages for select
  using (
    case
      when list_id is not null then public.can_access_list(list_id)
      else public.is_conversation_participant(conversation_id)
    end
  );

create policy messages_insert on public.messages for insert
  with check (
    case
      when list_id is not null then public.can_access_list(list_id)
      else
        public.is_conversation_participant(conversation_id)
        and user_id = (select auth.uid())
    end
  );

create policy messages_update on public.messages for update
  using (
    case
      when list_id is not null then public.can_access_list(list_id)
      else public.is_conversation_participant(conversation_id)
    end
  )
  with check (
    case
      when list_id is not null then public.can_access_list(list_id)
      else
        public.is_conversation_participant(conversation_id)
        and user_id = (select auth.uid())
    end
  );

create policy messages_delete on public.messages for delete
  using (
    case
      when list_id is not null then public.can_access_list(list_id)
      else public.is_conversation_participant(conversation_id)
    end
  );

-- The polls hang off a message and read its list_id. On a direct message that list_id is null, so their
-- policies returned false and a poll was impossible there — a closed failure, so with no leak, but
-- inconsistent. They all go through can_access_message, which makes them right for both scopes at once.
drop policy if exists polls_all on public.polls;
create policy polls_all on public.polls for all
  using (public.can_access_message(message_id))
  with check (public.can_access_message(message_id));

drop policy if exists poll_options_all on public.poll_options;
create policy poll_options_all on public.poll_options for all
  using (exists (
    select 1 from public.polls p
    where p.id = poll_id and public.can_access_message(p.message_id)))
  with check (exists (
    select 1 from public.polls p
    where p.id = poll_id and public.can_access_message(p.message_id)));

drop policy if exists poll_votes_select on public.poll_votes;
create policy poll_votes_select on public.poll_votes for select
  using (exists (
    select 1 from public.poll_options o join public.polls p on p.id = o.poll_id
    where o.id = option_id and public.can_access_message(p.message_id)));

-- poll_votes_write and poll_votes_delete only look at the vote's author and read no list: read again, they
-- come out right with no change.

-- 5. Opening a direct conversation.
--
-- The only possible write on these tables. It is idempotent: asking for the same pair again returns the
-- existing conversation rather than creating a second one, which the unique index would refuse anyway.
--
-- The function requires the two people to share at least one circle. The message itself will be attached to
-- none — but you have to have met somewhere to write to each other, otherwise knowing a uuid would be enough
-- to open a conversation with a stranger. So the circle serves as a directory here, not as a scope: exactly
-- what `household_profiles` already does for displayed names.
--
-- Leaving the shared circle does not close the conversation: what has been said stays between the two, and a
-- friendship is not cancelled because somebody left a shopping group.
create or replace function public.start_direct_conversation(other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  paire uuid[];
  trouve uuid;
begin
  if moi is null or other is null or moi = other then
    raise exception 'conversation directe impossible';
  end if;

  if not public.is_approved() then
    raise exception 'compte non approuve';
  end if;

  if not exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = moi and theirs.user_id = other
  ) then
    raise exception 'aucun cercle commun';
  end if;

  paire := array[least(moi, other), greatest(moi, other)];

  select c.id into trouve
  from public.conversations c
  where c.pair = paire and c.scope = 'direct';

  if trouve is not null then
    return trouve;
  end if;

  insert into public.conversations (scope, pair, created_by)
  values ('direct', paire, moi)
  returning id into trouve;

  insert into public.conversation_participants (conversation_id, user_id)
  values (trouve, paire[1]), (trouve, paire[2]);

  return trouve;
end;
$$;

comment on function public.start_direct_conversation(uuid) is
  'Ouvre — ou retrouve — la conversation directe entre l appelant et un autre compte avec lequel il partage un cercle. Seule ecriture possible sur conversations et conversation_participants : aucun droit d insertion n est accorde sur ces tables.';

-- 6. The privileges.
--
-- Reading only, and it has to be said explicitly: the schema carries default privileges granting select,
-- insert, update and delete to `authenticated` on any table created afterwards. Writing nothing here would
-- therefore NOT have closed writing — exactly the kind of hole we are trying to avoid, all the more so
-- because it does not show when reading the migration. The `revoke` is therefore the real lock; the absence
-- of a policy is only a second turn of the key.
grant select on public.conversations to authenticated;
grant select on public.conversation_participants to authenticated;
revoke insert, update, delete on public.conversations from authenticated;
revoke insert, update, delete on public.conversation_participants from authenticated;
grant execute on function public.is_conversation_participant(uuid) to authenticated;
grant execute on function public.can_access_message(uuid) to authenticated;

revoke all on function public.start_direct_conversation(uuid) from public;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

-- A conversation opened on one phone must appear on the other without a full reload. `messages` is already
-- published.
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_participants;
