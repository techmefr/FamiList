-- Rejoindre un foyer redevient possible.
--
-- redeem_invite supprime le foyer cree a l inscription, mais seulement s il est reste vierge, et
-- il exigeait pour cela qu il n ait aucun magasin. Or l application pose elle-meme un magasin par
-- defaut des la premiere ouverture : la condition etait donc toujours fausse, et l invitation
-- echouait systematiquement sur « quittez d abord votre foyer actuel ».
--
-- Le remede que ce message indique n existe pas : leave_household refuse de retirer le dernier
-- membre, et un foyer d inscription n en compte qu un. La personne n avait aucune sortie.
--
-- Les branches items et lists toleraient deja ce qui est cree automatiquement ; la branche shops
-- n avait pas suivi quand le magasin par defaut est apparu. Elle ne compte plus que les magasins
-- que quelqu un a vraiment ajoutes, et un magasin par defaut vide de rayonnage n en est pas un.

-- « Un compte, un foyer » n est tenu par aucune contrainte : la cle primaire de household_members
-- porte sur le couple (foyer, personne). L invariant ne vit que dans ces deux fonctions, et il
-- suffit qu elles se croisent pour qu il tombe — rejoindre une famille supprime le foyer
-- d inscription pendant qu un ensure_household en vol, ne le voyant plus, en recree un aussitot.
-- La personne se retrouve alors dans deux foyers, et l application lui montre le mauvais.
--
-- Un verrou par compte, pris par les deux fonctions, les met a la queue leu leu.
create or replace function public.lock_household_membership()
returns void
language sql
security definer
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtext('household:' || (select auth.uid())::text))
$$;

revoke all on function public.lock_household_membership() from public;

create or replace function public.redeem_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.household_invites;
  previous uuid;
  untouched boolean;
begin
  if not public.is_approved() then
    raise exception 'compte non valide' using errcode = '42501';
  end if;

  perform public.lock_household_membership();

  select * into invite
  from public.household_invites
  where code = upper(trim(invite_code))
  for update;

  if invite is null or invite.used_by is not null or invite.expires_at < now() then
    raise exception 'code invalide ou expire' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.household_members
    where household_id = invite.household_id and user_id = (select auth.uid())
  ) then
    return invite.household_id;
  end if;

  -- Un compte appartient a un seul foyer : celui qu on lui a cree a l inscription n a plus lieu
  -- d etre s il rejoint une famille. On ne le supprime que s il est reste vide, sinon on refuse
  -- plutot que d effacer des courses que quelqu un a saisies.
  select household_id into previous
  from public.household_members
  where user_id = (select auth.uid())
  order by joined_at
  limit 1;

  if previous is not null then
    select
      not exists (select 1 from public.items i join public.lists l on l.id = i.list_id where l.household_id = previous)
      and not exists (
        select 1
        from public.shops s
        where s.household_id = previous
          and (
            not s.is_default
            or exists (select 1 from public.shop_layouts sl where sl.shop_id = s.id and sl.learned)
            or exists (select 1 from public.shop_item_orders o where o.shop_id = s.id)
          )
      )
      and not exists (select 1 from public.loyalty_cards where household_id = previous)
      and (select count(*) from public.household_members where household_id = previous) = 1
    into untouched;

    if not untouched then
      raise exception 'quittez d abord votre foyer actuel' using errcode = '22023';
    end if;

    delete from public.households where id = previous;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (invite.household_id, (select auth.uid()), 'member');

  update public.household_invites
  set used_by = (select auth.uid()), used_at = now()
  where code = invite.code;

  return invite.household_id;
end;
$$;

revoke all on function public.redeem_invite(text) from public;
grant execute on function public.redeem_invite(text) to authenticated;

-- ensure_household prend le meme verrou, et relit l appartenance une fois qu il le tient : sans
-- cela, il decide sur un etat qui a pu changer entre-temps.
create or replace function public.ensure_household(household_name text default 'Ma maison')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
  created uuid;
begin
  if not public.is_approved() then
    raise exception 'compte non valide' using errcode = '42501';
  end if;

  perform public.lock_household_membership();

  select household_id into existing
  from public.household_members
  where user_id = (select auth.uid())
  order by joined_at
  limit 1;

  if existing is not null then
    return existing;
  end if;

  insert into public.households (name, created_by)
  values (coalesce(nullif(trim(household_name), ''), 'Ma maison'), (select auth.uid()))
  returning id into created;

  insert into public.household_members (household_id, user_id, role)
  values (created, (select auth.uid()), 'owner');

  -- Rayons de depart, dans l'ordre d'une grande surface classique. Sans eux, un nouveau compte
  -- ouvre une application vide ou rien ne peut etre range.
  insert into public.aisles (household_id, name, emoji, position, kind)
  values
    (created, 'Fruits & Légumes', '🥬', 0, 'fruits'),
    (created, 'Boulangerie', '🥖', 1, 'boulangerie'),
    (created, 'Produits laitiers', '🥛', 2, 'laitier'),
    (created, 'Viande & Poisson', '🐟', 3, 'viande'),
    (created, 'Épicerie', '🫙', 4, 'epicerie'),
    (created, 'Entretien', '🧴', 5, 'maison');

  insert into public.lists (household_id, name, emoji, color)
  values (created, 'Courses de la semaine', '🛒', '#C8532A');

  return created;
end;
$$;

revoke all on function public.ensure_household(text) from public;
grant execute on function public.ensure_household(text) to authenticated;

-- create_invite prenait le foyer de l appelant avec un limit 1 sans ordre : sur un compte qui en
-- aurait deux, il en choisissait un au hasard. Meme ordre que partout ailleurs, le plus ancien.
create or replace function public.create_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid;
  generated text;
begin
  select household_id into household
  from public.household_members
  where user_id = (select auth.uid())
  order by joined_at
  limit 1;

  if household is null or not public.is_household_member(household) then
    raise exception 'aucun foyer' using errcode = '42501';
  end if;

  -- Alphabet sans I, O, 0 ni 1 : le code est souvent dicte a l oral ou recopie a la main.
  loop
    generated := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
        1 + floor(random() * 32)::int, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.household_invites where code = generated);
  end loop;

  insert into public.household_invites (code, household_id, created_by, expires_at)
  values (generated, household, (select auth.uid()), now() + interval '7 days');

  return generated;
end;
$$;

revoke all on function public.create_invite() from public;
grant execute on function public.create_invite() to authenticated;
