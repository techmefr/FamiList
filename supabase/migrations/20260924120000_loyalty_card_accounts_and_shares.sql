-- A loyalty card's online-account credentials, and sharing a card with another circle after consent.
--
-- The password is not a column: it lives in Vault, encrypted at rest, under a name derived from the card, the
-- same mechanism as the instance secrets. Only `read_loyalty_card_password` returns it, to an aal2 session.
-- A database dump, a `select *` or a replica therefore never carries it in the clear. The device keeps its
-- own copy for offline use, encrypted under an unlock code (see src/lib/domain/offline-secret.ts).

comment on table public.loyalty_cards is
  'Informations de base d une carte. Le mot de passe du compte fidelite vit dans Vault, via loyalty_card_accounts. Le champ notes est libre et visible par tout le foyer et les foyers ayant accepte un partage.';

alter table public.loyalty_cards add column website_url text
  check (website_url is null or website_url ~* '^https?://[^[:space:]]+$');

create table public.loyalty_card_shares (
  card_id uuid not null references public.loyalty_cards on delete cascade,
  household_id uuid not null references public.households on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  shared_by uuid references auth.users on delete set null,
  decided_by uuid references auth.users on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (card_id, household_id)
);

create index loyalty_card_shares_household_idx on public.loyalty_card_shares (household_id);

alter table public.loyalty_card_shares enable row level security;

create or replace function public.is_card_owner(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.loyalty_cards c
    where c.id = target and public.is_household_member(c.household_id)
  )
$$;

create or replace function public.can_view_card(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_card_owner(target) or exists (
    select 1 from public.loyalty_card_shares s
    where s.card_id = target and s.status = 'accepted' and public.is_household_member(s.household_id)
  )
$$;

revoke all on function public.is_card_owner(uuid) from public, anon;
revoke all on function public.can_view_card(uuid) from public, anon;
grant execute on function public.is_card_owner(uuid) to authenticated;
grant execute on function public.can_view_card(uuid) to authenticated;

create policy loyalty_cards_shared_select on public.loyalty_cards for select
  using (public.can_view_card(id));

create policy loyalty_card_shares_select on public.loyalty_card_shares for select
  using (public.is_card_owner(card_id) or public.is_household_member(household_id));

create policy loyalty_card_shares_delete on public.loyalty_card_shares for delete
  using (public.is_card_owner(card_id) or public.is_household_member(household_id));

revoke all on table public.loyalty_card_shares from public, anon, authenticated;
grant select, delete on public.loyalty_card_shares to authenticated;

/*
 * The request, from the owning household, into a circle the requester also belongs to.
 *
 * No insert grant: going through here pins `status` to pending and `shared_by` to the caller. A declined
 * request may be asked again; a pending or accepted one is left as it is.
 */
create or replace function public.request_loyalty_card_share(card uuid, target_household uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_card_owner(card) then
    raise exception 'carte hors de votre foyer' using errcode = '42501';
  end if;

  if not public.is_household_member(target_household) then
    raise exception 'cercle inconnu' using errcode = '42501';
  end if;

  if exists (select 1 from public.loyalty_cards where id = card and household_id = target_household) then
    raise exception 'la carte appartient deja a ce cercle' using errcode = '22023';
  end if;

  insert into public.loyalty_card_shares (card_id, household_id, shared_by)
  values (card, target_household, (select auth.uid()))
  on conflict (card_id, household_id) do update
    set status = 'pending',
        shared_by = excluded.shared_by,
        decided_by = null,
        decided_at = null,
        created_at = now()
    where public.loyalty_card_shares.status = 'declined';
end;
$$;

/*
 * The consent step, taken by a member of the receiving household only. `shared_by` does not count: the
 * requester often belongs to both circles, and could otherwise accept on the others' behalf.
 */
create or replace function public.decide_loyalty_card_share(card uuid, target_household uuid, decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if decision not in ('accepted', 'declined') then
    raise exception 'decision invalide: %', decision using errcode = '22023';
  end if;

  if not public.is_household_member(target_household) then
    raise exception 'reserve au foyer destinataire' using errcode = '42501';
  end if;

  update public.loyalty_card_shares
  set status = decision,
      decided_by = (select auth.uid()),
      decided_at = now()
  where card_id = card
    and household_id = target_household
    and status = 'pending'
    and shared_by is distinct from (select auth.uid());

  if not found then
    raise exception 'aucune demande en attente a trancher' using errcode = '22023';
  end if;
end;
$$;

/* What a receiving member needs to decide: the card's name and who asks. Never its code. */
create or replace function public.pending_loyalty_card_shares()
returns table (
  card_id uuid,
  household_id uuid,
  card_name text,
  shared_by_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.card_id, s.household_id, c.name, p.display_name, s.created_at
  from public.loyalty_card_shares s
  join public.loyalty_cards c on c.id = s.card_id
  left join public.profiles p on p.id = s.shared_by
  where s.status = 'pending'
    and public.is_household_member(s.household_id)
    and s.shared_by is distinct from (select auth.uid())
  order by s.created_at
$$;

revoke all on function public.request_loyalty_card_share(uuid, uuid) from public, anon;
revoke all on function public.decide_loyalty_card_share(uuid, uuid, text) from public, anon;
revoke all on function public.pending_loyalty_card_shares() from public, anon;
grant execute on function public.request_loyalty_card_share(uuid, uuid) to authenticated;
grant execute on function public.decide_loyalty_card_share(uuid, uuid, text) to authenticated;
grant execute on function public.pending_loyalty_card_shares() to authenticated;

create table public.loyalty_card_accounts (
  card_id uuid primary key references public.loyalty_cards on delete cascade,
  email text,
  has_password boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null
);

comment on table public.loyalty_card_accounts is
  'Compte en ligne d une carte. Le mot de passe est dans Vault, lu par read_loyalty_card_password en aal2 seulement.';

alter table public.loyalty_card_accounts enable row level security;

create policy loyalty_card_accounts_select on public.loyalty_card_accounts for select
  using (public.can_view_card(card_id));

revoke all on table public.loyalty_card_accounts from public, anon, authenticated;
grant select on public.loyalty_card_accounts to authenticated;

create or replace function public.loyalty_card_secret_name(card uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'loyalty_card_password_' || card::text
$$;

revoke all on function public.loyalty_card_secret_name(uuid) from public, anon, authenticated;

/*
 * Strict aal2, not `is_approved()`: an account with no second factor at all must not read a password
 * synced over the network on the strength of its own password alone.
 */
create or replace function public.assert_card_secret_access()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_approved() then
    raise exception 'compte non valide' using errcode = '42501';
  end if;

  if coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    raise exception 'elevation requise' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_card_secret_access() from public, anon, authenticated;

/*
 * Writes the account. `password` null keeps the stored one, an empty string removes it. Owner household
 * only: a circle the card is shared into reads, it does not rewrite.
 */
create or replace function public.set_loyalty_card_account(card uuid, account_email text, password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
  cleaned_email text := nullif(btrim(coalesce(account_email, '')), '');
begin
  perform public.assert_card_secret_access();

  if not public.is_card_owner(card) then
    raise exception 'carte hors de votre foyer' using errcode = '42501';
  end if;

  insert into public.loyalty_card_accounts (card_id, email, updated_by)
  values (card, cleaned_email, (select auth.uid()))
  on conflict (card_id) do update
    set email = excluded.email, updated_at = now(), updated_by = excluded.updated_by;

  if password is null then
    return;
  end if;

  select s.id into existing from vault.secrets s where s.name = public.loyalty_card_secret_name(card);

  if password = '' then
    delete from vault.secrets s where s.name = public.loyalty_card_secret_name(card);
    update public.loyalty_card_accounts set has_password = false where card_id = card;
  elsif existing is null then
    perform vault.create_secret(password, public.loyalty_card_secret_name(card), 'Mot de passe de compte fidelite');
    update public.loyalty_card_accounts set has_password = true where card_id = card;
  else
    perform vault.update_secret(existing, password);
    update public.loyalty_card_accounts set has_password = true where card_id = card;
  end if;
end;
$$;

create or replace function public.read_loyalty_card_password(card uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  secret text;
begin
  perform public.assert_card_secret_access();

  if not public.can_view_card(card) then
    raise exception 'carte inaccessible' using errcode = '42501';
  end if;

  select s.decrypted_secret into secret
  from vault.decrypted_secrets s
  where s.name = public.loyalty_card_secret_name(card);

  return secret;
end;
$$;

revoke all on function public.set_loyalty_card_account(uuid, text, text) from public, anon;
revoke all on function public.read_loyalty_card_password(uuid) from public, anon;
grant execute on function public.set_loyalty_card_account(uuid, text, text) to authenticated;
grant execute on function public.read_loyalty_card_password(uuid) to authenticated;

/* Deleting a card, its household or the account row takes the Vault secret with it: no orphan left behind. */
create or replace function public.drop_loyalty_card_secret()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets s where s.name = public.loyalty_card_secret_name(old.card_id);
  return old;
end;
$$;

revoke all on function public.drop_loyalty_card_secret() from public, anon, authenticated;

create trigger loyalty_card_accounts_drop_secret
  after delete on public.loyalty_card_accounts
  for each row execute function public.drop_loyalty_card_secret();
