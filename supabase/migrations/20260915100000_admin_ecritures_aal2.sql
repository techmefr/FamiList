-- Le panneau d administration passe derriere la deuxieme etape, comme le reste.
--
-- `is_approved()` a ete redefinie par la migration MFA : des qu un compte a un facteur verifie,
-- elle exige que la session l ait effectivement presente. Toutes les regles d acces aux donnees
-- d un foyer passent par elle. `is_admin()`, elle, n a jamais bouge : role `admin` et statut
-- `approved`, sans un mot sur le niveau d authentification.
--
-- L asymetrie se lit simplement : quelqu un qui obtient le mot de passe d un administrateur sans
-- son second facteur ne voit aucune liste de courses, mais peut appeler `review_account`,
-- `set_demo` et `reset_demo` directement sur l API. Il valide son propre compte en attente, le
-- marque en demonstration, et il est entre. La 2FA de l administrateur ne protegeait que ses
-- courses, pas l instance.
--
-- Ce qui est verrouille ici, et ce qui ne l est pas. Les ecritures, toutes. Les lectures
-- (`pending_accounts`, `list_bug_reports`), non : elles gardent `is_admin()` seule. Un
-- administrateur bloque doit pouvoir voir l ecran et comprendre pourquoi il est refuse, plutot que
-- de tomber sur un « reserve aux administrateurs » qui lui ferait croire qu il a perdu son role.
-- Et cela n ouvre rien de neuf : la regle `profiles_select` laisse deja lire tous les profils a
-- `is_admin()`, et ces deux fonctions existaient deja avec ce meme garde-fou.
--
-- Le piege a eviter etait l enfermement : exiger aal2 pour atteindre `/admin` enfermerait dehors
-- l administrateur qui perd son telephone. Il n y a pas d enfermement, parce que le chemin de
-- retour ne passe pas par `/admin` et existait avant ce fichier :
--
--   1. les codes de secours — `consume_backup_code` s appelle depuis une session restee en aal1,
--      retire le facteur, et l ecran `/auth/mfa` les propose des la premiere vue ;
--   2. a defaut, un second administrateur et `admin_reset_mfa`, pose par la migration precedente ;
--   3. en dernier recours, la procedure hors application documentee dans cette meme migration.
--
-- Un compte administrateur sans facteur verifie n est gene par rien : `is_approved()` ne reclame
-- aal2 qu a ceux qui se le sont impose. Le verrou pose ici suit ce compte, il ne l invente pas.
--
-- Deux refus, deux messages. « reserve aux administrateurs » veut dire « ce n est pas votre role »
-- et n a pas de suite ; « elevation requise » veut dire « c est bien votre role, finissez de vous
-- connecter » et a une sortie. Les confondre sous un seul texte enverrait la moitie des gens
-- chercher au mauvais endroit.

/*
 * Le garde-fou commun a toutes les ecritures du panneau.
 *
 * Ecrit une fois plutot que recopie sept fois : c est le genre de condition qu on oublie de
 * reporter sur la huitieme fonction, et l oubli ne se voit pas — la fonction marche, elle marche
 * juste aussi pour qui ne devrait pas.
 *
 * L ordre des deux tests fait le message : `is_admin()` ne dit rien du niveau d authentification,
 * `is_approved()` ne dit rien du role. Teste dans ce sens, le refus qui sort designe la bonne
 * cause.
 *
 * Le `revoke` nomme `anon` et `authenticated` en plus de `public` : les privileges par defaut du
 * projet accordent l execution de toute fonction neuve a ces deux roles, et un `revoke ... from
 * public` seul les laisse en place. Seules les fonctions `security definer` ci-dessous appellent
 * celle-ci, sous le compte proprietaire. Rien de ce qui est ajoute ici n est joignable par une
 * regle d acces.
 */
create or replace function public.assert_admin_write()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'reserve aux administrateurs' using errcode = '42501';
  end if;

  if not public.is_approved() then
    raise exception 'elevation requise' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_admin_write() from public, anon, authenticated;

comment on function public.assert_admin_write() is
  'Refuse une ecriture d administration, en distinguant le role manquant de la session non elevee. Appelee par les fonctions du panneau, jamais accordee a authenticated.';

-- Valider ou refuser une inscription. Le corps ne change pas : seul le garde-fou s ouvre moins.
create or replace function public.review_account(target uuid, decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  if decision not in ('approved', 'rejected', 'pending') then
    raise exception 'decision invalide: %', decision using errcode = '22023';
  end if;

  if target = (select auth.uid()) then
    raise exception 'un administrateur ne revise pas son propre compte' using errcode = '42501';
  end if;

  update public.profiles
  set status = decision,
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
  where id = target;
end;
$$;

-- Marquer un compte en demonstration, ce qui le valide au passage : c est une ecriture de plus
-- qui ouvrait l instance sans second facteur.
create or replace function public.set_demo(target uuid, demo boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  -- Un compte de demonstration est ouvert par definition : le marquer le valide.
  update public.profiles
  set is_demo = demo,
      status = case when demo then 'approved' else status end,
      reviewed_at = now(),
      reviewed_by = (select auth.uid())
  where id = target;
end;
$$;

-- La plus destructrice des trois : elle vide le foyer de demonstration.
create or replace function public.reset_demo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  demo_household uuid;
begin
  perform public.assert_admin_write();

  select m.household_id into demo_household
  from public.household_members m
  join public.profiles p on p.id = m.user_id
  where p.is_demo
  limit 1;

  if demo_household is null then
    raise exception 'aucun compte de demonstration' using errcode = '22023';
  end if;

  delete from public.lists where household_id = demo_household;
  delete from public.shops where household_id = demo_household;
  delete from public.loyalty_cards where household_id = demo_household;
  delete from public.aisles where household_id = demo_household;

  insert into public.aisles (household_id, name, emoji, position, kind)
  values
    (demo_household, 'Fruits & Légumes', '🥬', 0, 'fruits'),
    (demo_household, 'Boulangerie', '🥖', 1, 'boulangerie'),
    (demo_household, 'Produits laitiers', '🥛', 2, 'laitier'),
    (demo_household, 'Viande & Poisson', '🐟', 3, 'viande'),
    (demo_household, 'Épicerie', '🫙', 4, 'epicerie'),
    (demo_household, 'Entretien', '🧴', 5, 'maison');

  insert into public.lists (household_id, name, emoji, color)
  values (demo_household, 'Courses de la semaine', '🛒', '#C8532A');
end;
$$;

-- Absente de l enonce du probleme, mais c est la meme porte : une ecriture d administration
-- gardee par `is_admin()` seule. La laisser dehors aurait fait de ce fichier une correction a
-- trous.
create or replace function public.resolve_bug_report(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  update public.bug_reports
  set status = 'resolved', resolved_at = now()
  where id = target;
end;
$$;

-- Les trois fonctions de la migration precedente exigeaient deja aal2, par un
-- `is_admin() and is_approved()` qui ne rendait qu un message pour deux causes. Elles passent par
-- le garde-fou commun : meme verrou qu avant, message juste, et une seule definition a relire le
-- jour ou cette regle changera.
create or replace function public.promote_admin(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  if not exists (
    select 1 from public.profiles where id = target and status = 'approved'
  ) then
    raise exception 'le compte doit etre valide avant d etre promu' using errcode = '42501';
  end if;

  update public.profiles set role = 'admin' where id = target;
end;
$$;

create or replace function public.demote_admin(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  update public.profiles set role = 'user' where id = target;
end;
$$;

/*
 * `target <> auth.uid()` reste ecrit, et pour la meme raison qu avant : cette fonction ne doit pas
 * pouvoir servir a son appelant a se deverrouiller lui-meme, et cette interdiction ne doit pas
 * dependre de la definition d une autre fonction. Le garde-fou aal2 l interdit deja deux fois.
 */
create or replace function public.admin_reset_mfa(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  if target = (select auth.uid()) then
    raise exception 'un administrateur ne deverrouille pas son propre compte' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = target) then
    raise exception 'compte introuvable' using errcode = '42501';
  end if;

  delete from auth.mfa_factors where user_id = target;
  delete from public.mfa_backup_codes where user_id = target;
  delete from auth.sessions where user_id = target;
end;
$$;

comment on function public.review_account(uuid, text) is
  'Valide ou refuse une inscription. Reserve a un administrateur dont la session est au niveau que son compte s impose.';
comment on function public.set_demo(uuid, boolean) is
  'Marque un compte de demonstration, ce qui le valide. Meme garde-fou que la validation d un compte.';
comment on function public.resolve_bug_report(uuid) is
  'Clot un signalement. Ecriture d administration, donc derriere la deuxieme etape.';
