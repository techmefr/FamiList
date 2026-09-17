-- Les messages directs, hors de tout cercle.
--
-- Jusqu ici une discussion n existait qu attachee a une liste : `messages.list_id` etait not null,
-- et la seule porte d entree du chat etait `/l/[id]/chat`. Le proprietaire a tranche trois portees
-- pour une conversation — le cercle, l evenement, et la personne a personne. Cette migration ne
-- livre que la troisieme, entiere ; les deux autres restent a faire et rien ici ne les prejuge.
--
-- Pourquoi la troisieme d abord : c est celle qui ne rentre dans aucun moule existant. Un message
-- prive est prive, donc il ne se rattache a aucun foyer. Ce n est pas une commodite, c est la
-- reponse a une ambiguite reelle : avec l appartenance multiple, deux personnes partagent souvent
-- plusieurs cercles, et rattacher leur conversation a l un d eux serait un choix arbitraire qui la
-- rendrait lisible par les autres membres de ce cercle. Une conversation directe n appartient donc
-- a personne d autre qu a ses deux participants.
--
-- Ce que cela coute : `is_household_member` et `can_access_list`, les deux gardes sur lesquelles
-- tout le reste du schema s appuie, ne s appliquent plus. Il n y a pas de `household_id` derriere
-- lequel s abriter. La RLS de ce perimetre a deja porte trois failles (#15, #16, #17), plus deux
-- trouvees en rendant `lists.household_id` nullable (#145) ; on n improvise pas ici.
--
-- Le choix qui ferme le sujet : les deux tables de conversation ne portent AUCUN droit d ecriture.
-- Ni insert, ni update, ni delete pour `authenticated` — revoques explicitement plus bas, parce que
-- les droits par defaut du schema les accordent d office a toute table nouvelle. Une conversation
-- directe ne peut donc naitre que par `start_direct_conversation`, qui la cree avec ses deux
-- participants dans la meme transaction. Autrement dit, la question « quelqu un peut-il s ajouter a
-- une conversation existante ? » ne se joue pas dans une policy subtile : le verbe n est pas
-- accorde. C est la seule forme de preuve qui tienne sur ce perimetre.
--
-- La paire est enfin unique par construction, via une colonne calculee `pair` : deux personnes
-- n ont qu une seule conversation directe, et une troisieme ne peut pas s y glisser puisque la
-- colonne ne decrit que deux comptes.

-- 1. La conversation.
--
-- `scope` ne prend pour l instant qu une valeur. La colonne est la parce que le modele tranche en
-- porte trois et que la contrainte s elargira quand les deux autres arriveront ; elle n affirme
-- aujourd hui que ce qui est reellement applique.
--
-- `pair` porte les deux comptes tries. C est elle qui rend l unicite de la paire verifiable par
-- l index plutot que par du code, et qui interdit structurellement une conversation directe a trois.
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

-- On lit toujours « mes conversations », jamais « les participants de celle-ci » en premier.
create index conversation_participants_user_idx on public.conversation_participants (user_id);

-- 2. Un message se rattache a une liste OU a une conversation, jamais aux deux ni a aucune.
--
-- `list_id` devient nullable, comme `lists.household_id` l est devenu. Le piege est le meme et il
-- se traite pareil : chaque policy qui lisait `list_id` est reprise explicitement plus bas, meme
-- celles qui n en avaient pas besoin, avec la raison ecrite. Un null oublie dans un `where` fait
-- soit disparaitre un message, soit fuiter.
alter table public.messages alter column list_id drop not null;

alter table public.messages
  add column conversation_id uuid references public.conversations on delete cascade;

alter table public.messages
  add constraint messages_one_scope check (num_nonnulls(list_id, conversation_id) = 1);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

comment on column public.messages.conversation_id is
  'La conversation qui porte le message, ou null si le message appartient a une liste. Exactement une des deux colonnes est renseignee.';

-- 3. Les gardes.
--
-- security definer pour la meme raison que can_access_list : ces fonctions sont appelees depuis les
-- policies des tables qu elles lisent, et repasser sous RLS ferait tourner la policy en rond.
create or replace function public.is_conversation_participant(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- L approbation est redemandee ici comme dans is_household_member et can_access_list : un compte
  -- suspendu ne lit plus rien, et une conversation directe ne fait pas exception.
  select public.is_approved() and exists (
    select 1
    from public.conversation_participants p
    where p.conversation_id = target and p.user_id = (select auth.uid())
  )
$$;

comment on function public.is_conversation_participant(uuid) is
  'Vrai si l appelant participe a la conversation. Seule garde d une conversation directe : elle n a aucun foyer, donc is_household_member ne s y applique pas.';

-- L acces a un message, quelle que soit sa portee. Un seul endroit ou le choix entre les deux
-- colonnes est ecrit : les sondages, qui pendent aux messages, s y branchent au lieu de refaire le
-- test chacun de leur cote et de se tromper un jour.
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

-- 4. Les politiques.
--
-- Lecture seule sur les deux tables de conversation, et rien d autre : voir l en-tete. Une
-- conversation ne se lit que si on y participe, et la liste des participants suit la conversation.
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;

create policy conversations_select on public.conversations for select
  using (public.is_conversation_participant(id));

create policy conversation_participants_select on public.conversation_participants for select
  using (public.is_conversation_participant(conversation_id));

-- Les messages. L ancienne policy appelait can_access_list(list_id) sans condition ; avec un
-- list_id null elle rendait faux, donc aucun message direct n aurait ete lisible, pas meme par ses
-- deux participants. Elle est remplacee, pas completee, pour qu il n en reste qu une a lire.
--
-- Le with check ajoute ce que l ancienne ne demandait pas sur la portee directe : etre l auteur du
-- message. Sur une conversation a deux, ecrire au nom de l autre n est pas un detail — et rien dans
-- le reste du schema ne l empechait.
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

-- Les sondages pendent a un message et lisaient son list_id. Sur un message direct ce list_id est
-- null, donc leurs policies rendaient faux et un sondage y etait impossible — un echec ferme, donc
-- sans fuite, mais incoherent. Elles passent toutes par can_access_message, ce qui les rend justes
-- pour les deux portees d un coup.
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

-- poll_votes_write et poll_votes_delete ne regardent que l auteur du vote et ne lisent aucune
-- liste : relues, elles tombent juste sans changement.

-- 5. Ouvrir une conversation directe.
--
-- Seule ecriture possible sur ces tables. Elle est idempotente : redemander la meme paire rend la
-- conversation existante plutot que d en creer une seconde, ce que l index unique refuserait de
-- toute facon.
--
-- La fonction exige que les deux personnes partagent au moins un cercle. Le message, lui, ne sera
-- rattache a aucun — mais il faut bien s etre rencontre quelque part pour s ecrire, sinon il
-- suffirait de connaitre un uuid pour ouvrir une conversation avec un inconnu. Le cercle sert donc
-- ici d annuaire, pas de portee : c est exactement ce que `household_profiles` fait deja pour les
-- noms affiches.
--
-- Quitter le cercle commun ne ferme pas la conversation : ce qui a ete dit reste entre les deux, et
-- une amitie ne s annule pas parce qu on a quitte un groupe de courses.
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

-- 6. Les droits.
--
-- La lecture seulement, et il faut le dire explicitement : le schema porte des droits par defaut
-- qui accordent select, insert, update et delete a `authenticated` sur toute table creee ensuite.
-- Ne rien ecrire ici n aurait donc PAS ferme l ecriture — c est exactement le genre de trou qu on
-- cherche a eviter, d autant qu il ne se voit pas a la lecture de la migration. Le `revoke` est
-- donc la vraie serrure ; l absence de policy n est qu un second tour de cle.
grant select on public.conversations to authenticated;
grant select on public.conversation_participants to authenticated;
revoke insert, update, delete on public.conversations from authenticated;
revoke insert, update, delete on public.conversation_participants from authenticated;
grant execute on function public.is_conversation_participant(uuid) to authenticated;
grant execute on function public.can_access_message(uuid) to authenticated;

revoke all on function public.start_direct_conversation(uuid) from public;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

-- Une conversation ouverte sur un telephone doit apparaitre sur l autre sans relecture complete.
-- `messages` est deja publiee.
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_participants;
