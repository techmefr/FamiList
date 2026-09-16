-- Ne plus dependre d un seul compte, ni d un seul telephone.
--
-- Deux pannes se ressemblent et n avaient pas de reponse dans l app. Le seul administrateur perd
-- son second facteur : `is_approved()` exige aal2 des qu un facteur verifie existe, donc plus rien
-- ne s ouvre. Ou bien ce compte disparait tout court : plus personne ne peut valider une
-- inscription, et l instance se ferme toute seule. Les deux se reglaient jusqu ici avec un editeur
-- SQL sur la production, ce qui n est pas une procedure, c est un aveu.
--
-- Ce qui existe deja et qu on ne refait pas : les codes de secours (`consume_backup_code`) couvrent
-- le cas courant du telephone perdu, y compris pour un administrateur, et depuis une session restee
-- en aal1. Ce fichier ne traite que ce qu ils ne couvrent pas.
--
-- Le choix de fond : aucune de ces fonctions ne contourne la 2FA de celui qui l appelle. Une porte
-- de secours ouverte par son propre proprietaire n est pas une porte de secours, c est une serrure
-- en moins. Le garde-fou commun est donc `is_admin() and is_approved()` : administrateur valide,
-- et au niveau d authentification que son compte s est lui-meme impose. Un administrateur bloque en
-- aal1 ne peut donc rien deverrouiller, ni pour lui ni pour un autre — c est voulu.
--
-- Reste un cas qu aucun code ne peut traiter honnetement : le dernier administrateur, sans codes de
-- secours, sans second facteur. Lui donner une sortie dans l app voudrait dire donner a quiconque
-- prend son mot de passe une sortie identique. Ce cas se traite hors de l app, avec la cle de
-- service, et la seule chose a faire est de nommer un second administrateur :
--
--   update public.profiles set role = 'admin', status = 'approved'
--   where id = (select id from auth.users where email = 'quelqu-un@exemple.fr');
--
-- puis, depuis ce compte, d utiliser `admin_reset_mfa` sur le compte bloque. C est la procedure
-- documentee demandee, et elle n existe que parce que la seule alternative serait une porte
-- derobee.
--
-- Le declencheur plus bas rend ce cas rare : le dernier administrateur ne peut plus etre retrograde
-- ni refuse, ni par l app ni par une ecriture directe.

/*
 * Nommer un second administrateur.
 *
 * C est la reponse a la panne de fond : tant qu il n y a qu un compte capable de valider les
 * inscriptions et de debloquer les autres, tout le reste n est que du rafistolage autour de lui.
 *
 * La cible doit deja etre approuvee. Promouvoir un compte en attente reviendrait a le valider au
 * passage, en sautant `review_account` et la trace qu elle laisse dans `reviewed_by`.
 *
 * Aucune regle d acces n est ajoutee sur `profiles` : `role` reste hors du `grant update` accorde a
 * `authenticated`, et cette colonne ne se change que par ici.
 */
create or replace function public.promote_admin(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() and public.is_approved()) then
    raise exception 'reserve aux administrateurs' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles where id = target and status = 'approved'
  ) then
    raise exception 'le compte doit etre valide avant d etre promu' using errcode = '42501';
  end if;

  update public.profiles set role = 'admin' where id = target;
end;
$$;

/*
 * Retirer le role administrateur.
 *
 * Se retrograder soi-meme est permis : c est le geste normal quand on passe la main apres avoir
 * nomme son successeur. Ce qui est interdit, c est d arriver a zero — le declencheur ci-dessous
 * s en charge, pour que l interdiction tienne aussi sur une ecriture qui ne passerait pas par ici.
 */
create or replace function public.demote_admin(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() and public.is_approved()) then
    raise exception 'reserve aux administrateurs' using errcode = '42501';
  end if;

  update public.profiles set role = 'user' where id = target;
end;
$$;

/*
 * Retirer le deuxieme facteur d un autre compte.
 *
 * C est la reponse au telephone perdu quand les dix codes de secours le sont aussi. La fonction
 * ramene le compte cible a l etat d avant sa 2FA, exactement comme le ferait un de ses propres
 * codes : les facteurs partent, les codes restants aussi. Garder des condensats orphelins n aurait
 * servi qu a laisser trainer des codes valides pour une 2FA qui n existe plus.
 *
 * `target <> auth.uid()` est la ligne qui empeche cette fonction d etre un contournement de 2FA.
 * Le garde-fou aal2 l interdit deja — un administrateur bloque en aal1 n est pas `is_approved()` —
 * mais la condition est ecrite quand meme : elle ne depend pas de la definition d une autre
 * fonction, et c est le genre de dependance qu on ne veut pas sur ce chemin-la.
 *
 * Les sessions de la cible sont fermees. Une session deja elevee en aal2 le resterait dans son
 * jeton alors que le facteur qui l a justifiee vient d etre retire : c est justement la session de
 * celui qui a pris le telephone.
 */
create or replace function public.admin_reset_mfa(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() and public.is_approved()) then
    raise exception 'reserve aux administrateurs' using errcode = '42501';
  end if;

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

/*
 * Le dernier administrateur ne part pas.
 *
 * Retrograder ou refuser le seul compte administrateur ferme l instance de facon definitive du
 * point de vue de l app : plus personne ne peut valider une inscription, donc plus personne ne peut
 * devenir administrateur. Le declencheur est pose sur la table plutot que dans `demote_admin` pour
 * qu il tienne aussi face a `review_account`, a une correction faite a la main, et a la cle de
 * service — c est-a-dire face aux trois chemins par lesquels l erreur arriverait vraiment.
 *
 * Seul `update` est surveille. La suppression du profil suit celle du compte `auth.users` et
 * l empecher rendrait un compte impossible a supprimer ; ce cas-la se voit et se rattrape, alors
 * qu une retrogradation passe inapercue jusqu a la prochaine inscription.
 */
create or replace function public.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.status = 'approved'
     and not (new.role = 'admin' and new.status = 'approved') then
    if not exists (
      select 1 from public.profiles
      where role = 'admin' and status = 'approved' and id <> old.id
    ) then
      raise exception 'il doit rester au moins un administrateur' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_keep_one_admin
  before update on public.profiles
  for each row
  execute function public.keep_one_admin();

-- Le panneau admin doit pouvoir distinguer qui est administrateur et qui est bloque derriere un
-- facteur perdu. Deux colonnes de plus changent le type de retour : Postgres refuse un simple
-- remplacement.
drop function public.pending_accounts();

create function public.pending_accounts()
returns table (
  id uuid,
  display_name text,
  email text,
  requested_at timestamptz,
  status text,
  is_demo boolean,
  role text,
  has_mfa boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    u.email::text,
    p.requested_at,
    p.status,
    p.is_demo,
    p.role,
    exists (
      select 1 from auth.mfa_factors f
      where f.user_id = p.id and f.status = 'verified'
    ) as has_mfa
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.requested_at
$$;

revoke all on function public.pending_accounts() from public;
revoke all on function public.promote_admin(uuid) from public;
revoke all on function public.demote_admin(uuid) from public;
revoke all on function public.admin_reset_mfa(uuid) from public;
revoke all on function public.keep_one_admin() from public;

grant execute on function public.pending_accounts() to authenticated;
grant execute on function public.promote_admin(uuid) to authenticated;
grant execute on function public.demote_admin(uuid) to authenticated;
grant execute on function public.admin_reset_mfa(uuid) to authenticated;

comment on function public.promote_admin(uuid) is
  'Nomme un second administrateur. Reserve a un administrateur valide et au niveau d authentification que son compte s impose.';
comment on function public.demote_admin(uuid) is
  'Retire le role administrateur. Le declencheur profiles_keep_one_admin empeche d arriver a zero.';
comment on function public.admin_reset_mfa(uuid) is
  'Retire le deuxieme facteur d un autre compte, jamais du sien. Dernier recours apres les codes de secours.';
comment on function public.keep_one_admin() is
  'Refuse la derniere retrogradation ou le dernier refus qui laisserait l instance sans administrateur.';
