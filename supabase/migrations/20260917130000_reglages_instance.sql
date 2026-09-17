-- Les reglages d instance, poses depuis /admin plutot que depuis un terminal.
--
-- Pourquoi ce fichier existe. Faire partir un courriel demandait jusqu ici `supabase secrets set`,
-- donc une ligne de commande, un projet lie et une CLI installee. Personne qui n est pas
-- developpeur ne franchit ces trois marches, et c est pourtant cette personne-la qui heberge son
-- instance. Tant que l envoi n est pas configure, `admin_notifications` se remplit et rien ne part :
-- le silence est total et ressemble a une panne. La configuration doit donc se poser depuis
-- l ecran, et l ecran doit dire ou elle en est.
--
-- Pourquoi une table de reglages et non une table de courriel. #137 vient de poser le meme besoin
-- pour son jeton de suivi de depot, et la migration suivante inventerait la meme mecanique sous un
-- autre nom. Ce qui est pose ici est donc un porte-reglages : un catalogue de cles connues, deux
-- ecritures, une lecture. Le courriel n en est que le premier occupant.
--
-- Pourquoi le secret ne vit pas dans une colonne. Un mot de passe SMTP en clair dans une table,
-- modifiable depuis une page web, c est un relais de courriel offert a qui prend la main sur un
-- compte administrateur. Vault chiffre au repos et ne rend la valeur qu a une fonction
-- `security definer` tournant sous le compte proprietaire. Le depot s en sert deja pour les
-- secrets de reveil de `notify-admins` : rien de neuf, seulement un usage de plus.
--
-- Pourquoi aucune fonction ne relit le secret. `instance_settings_read()` est la seule lecture
-- joignable par un client, et elle ne rend jamais la valeur d une cle secrete — seulement le fait
-- qu elle soit posee et la date. Meme l administrateur qui vient de taper son mot de passe ne peut
-- plus le relire : l ecran propose de le remplacer, jamais de l afficher. Un onglet oublie ouvert
-- ne livre donc rien.
--
-- Pourquoi les ecritures passent par `assert_admin_write()`. Depuis #128, toute ecriture du
-- panneau exige `aal2`. Une politique RLS permissive sur `instance_settings` aurait ouvert la porte
-- a une session restee au mot de passe seul — exactement le scenario ou quelqu un vient de voler
-- un mot de passe d administrateur et cherche un relais de spam.
--
-- Pourquoi les variables d environnement gardent la priorite. Une instance deja configuree par
-- `supabase secrets set` — celle du depot, notamment — ne doit pas casser parce que cette
-- migration passe. Les fonctions edge lisent donc l environnement d abord, la base ensuite, cle
-- par cle. Rien a migrer pour qui n a rien a changer.
--
-- Pourquoi un plafond d envoi et un expediteur epingle. Un compte administrateur compromis ne doit
-- pas devenir une passerelle a spam. L expediteur ne se choisit pas au coup par coup : il vient du
-- reglage, et le courriel de test part vers la seule adresse du compte qui clique. Le plafond
-- journalier, lui, borne les degats meme si tout le reste tombe.

/*
 * Le catalogue des cles connues, et leur valeur en clair quand elles n ont rien de secret.
 *
 * Les lignes sont posees par cette migration et par elle seule : `set_instance_setting` refuse une
 * cle absente. Sans ce garde-fou, un administrateur pourrait ecrire dans Vault autant de secrets
 * qu il veut, sous les noms qu il veut — un coffre que personne ne relit n est plus un coffre,
 * c est une decharge.
 *
 * `value` reste toujours `null` sur une ligne secrete. La ligne existe quand meme : elle porte la
 * date de pose, qui est ce que l ecran affiche a la place de la valeur.
 */
create table if not exists public.instance_settings (
  key text primary key,
  value text,
  is_secret boolean not null default false,
  is_set boolean not null default false,
  updated_at timestamptz,
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.instance_settings is
  'Reglages d instance poses depuis /admin. Les valeurs secretes vivent dans Vault, jamais dans `value`.';

-- Aucune politique : la table n est jointe que par les fonctions `security definer` ci-dessous.
-- RLS activee sans politique veut dire « personne », ce qui est exactement l intention.
alter table public.instance_settings enable row level security;

revoke all on table public.instance_settings from public, anon, authenticated;

insert into public.instance_settings (key, is_secret)
values
  ('mail_smtp_host', false),
  ('mail_smtp_port', false),
  ('mail_smtp_user', false),
  ('mail_smtp_password', true),
  ('mail_from', false),
  ('issue_tracker_repo', false),
  ('issue_tracker_api', false),
  ('issue_tracker_token', true)
on conflict (key) do nothing;

/*
 * Le compteur d envois, un seau par jour.
 *
 * Une seule ligne par journee, creee au premier envoi : rien a purger, rien a planifier, et la
 * table reste lisible a l oeil. Le plafond est volontairement haut pour une instance familiale et
 * bas pour une campagne de spam.
 */
create table if not exists public.instance_mail_quota (
  day date primary key,
  sent integer not null default 0
);

comment on table public.instance_mail_quota is
  'Nombre de courriels partis par journee. Borne les degats si un compte administrateur est pris.';

alter table public.instance_mail_quota enable row level security;

revoke all on table public.instance_mail_quota from public, anon, authenticated;

/*
 * Le nom du secret dans Vault, deduit de la cle.
 *
 * Nomme une fois plutot que recopie dans trois fonctions : le jour ou l une des trois ecrit
 * `instance-setting-...` au lieu de `instance_setting_...`, le secret est pose et jamais relu, et
 * l ecran affiche « configure » sur un coffre vide.
 */
create or replace function public.instance_secret_name(setting_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'instance_setting_' || setting_key
$$;

revoke all on function public.instance_secret_name(text) from public, anon, authenticated;

/*
 * Ce que l ecran a le droit de savoir.
 *
 * `value` sort en clair pour une cle ordinaire et vaut toujours `null` pour une cle secrete — la
 * distinction est faite ici, dans la base, et non dans le client : un client se remplace par une
 * requete `curl`.
 *
 * Lecture reservee a `is_admin()` seul, sans `aal2`, comme les autres lectures du panneau depuis
 * #128 : un administrateur bloque au premier facteur doit pouvoir ouvrir l ecran et comprendre
 * pourquoi il est refuse, plutot que de croire qu il a perdu son role.
 */
create or replace function public.instance_settings_read()
returns table (
  key text,
  value text,
  is_secret boolean,
  is_set boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.key,
    case when s.is_secret then null else s.value end,
    s.is_secret,
    s.is_set,
    s.updated_at
  from public.instance_settings s
  where public.is_admin()
  order by s.key
$$;

revoke all on function public.instance_settings_read() from public, anon, authenticated;
grant execute on function public.instance_settings_read() to authenticated;

comment on function public.instance_settings_read() is
  'Etat des reglages pour /admin. Ne rend jamais la valeur d une cle secrete, seulement le fait qu elle soit posee.';

/*
 * Poser une valeur.
 *
 * Les verifications de forme sont ici et pas seulement dans l ecran, parce qu elles servent a
 * quelque chose : un port a 0 ou une adresse d expediteur sans arobase produiraient un echec
 * d envoi asynchrone et muet, deux jours plus tard, sans que personne ne fasse le lien avec la
 * frappe du mardi.
 *
 * Une valeur vide efface : c est le geste naturel pour retirer un reglage, et il n a pas besoin
 * d un second bouton.
 */
create or replace function public.set_instance_setting(setting_key text, setting_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  catalogue public.instance_settings%rowtype;
  cleaned text;
  existing uuid;
begin
  perform public.assert_admin_write();

  select * into catalogue from public.instance_settings s where s.key = setting_key;

  if not found then
    raise exception 'reglage inconnu: %', setting_key using errcode = '22023';
  end if;

  cleaned := nullif(btrim(coalesce(setting_value, '')), '');

  if cleaned is null then
    perform public.clear_instance_setting(setting_key);
    return;
  end if;

  if setting_key = 'mail_smtp_port' then
    if cleaned !~ '^[0-9]{1,5}$' or cleaned::integer < 1 or cleaned::integer > 65535 then
      raise exception 'port invalide' using errcode = '22023';
    end if;
  end if;

  if setting_key = 'mail_from' and cleaned !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'expediteur invalide' using errcode = '22023';
  end if;

  if setting_key = 'issue_tracker_repo' and cleaned !~ '^[^[:space:]/]+/[^[:space:]/]+$' then
    raise exception 'depot invalide' using errcode = '22023';
  end if;

  if catalogue.is_secret then
    select s.id into existing
    from vault.secrets s
    where s.name = public.instance_secret_name(setting_key);

    if existing is null then
      perform vault.create_secret(cleaned, public.instance_secret_name(setting_key), 'Reglage d instance pose depuis /admin');
    else
      perform vault.update_secret(existing, cleaned);
    end if;

    -- `value` reste vide : la table ne doit jamais porter une copie de ce que Vault chiffre.
    update public.instance_settings
    set value = null,
        is_set = true,
        updated_at = now(),
        updated_by = (select auth.uid())
    where key = setting_key;
  else
    update public.instance_settings
    set value = cleaned,
        is_set = true,
        updated_at = now(),
        updated_by = (select auth.uid())
    where key = setting_key;
  end if;
end;
$$;

revoke all on function public.set_instance_setting(text, text) from public, anon, authenticated;
grant execute on function public.set_instance_setting(text, text) to authenticated;

comment on function public.set_instance_setting(text, text) is
  'Pose un reglage d instance. Refuse une cle hors catalogue, range les secrets dans Vault, exige aal2.';

/*
 * Retirer une valeur.
 *
 * Le secret est supprime de Vault et pas seulement oublie de la table : un secret orphelin dans le
 * coffre serait toujours lisible par la fonction edge, et un reglage « efface » continuerait a
 * servir.
 */
create or replace function public.clear_instance_setting(setting_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  if not exists (select 1 from public.instance_settings s where s.key = setting_key) then
    raise exception 'reglage inconnu: %', setting_key using errcode = '22023';
  end if;

  delete from vault.secrets s where s.name = public.instance_secret_name(setting_key);

  update public.instance_settings
  set value = null,
      is_set = false,
      updated_at = now(),
      updated_by = (select auth.uid())
  where key = setting_key;
end;
$$;

revoke all on function public.clear_instance_setting(text) from public, anon, authenticated;
grant execute on function public.clear_instance_setting(text) to authenticated;

comment on function public.clear_instance_setting(text) is
  'Efface un reglage d instance, y compris le secret correspondant dans Vault. Exige aal2.';

/*
 * Ce que les fonctions edge lisent, secrets compris.
 *
 * Accordee au seul `service_role`, qui ne vit que dans les secrets du projet et jamais dans le
 * bundle publie. C est la seule sortie des valeurs secretes, et elle ne va nulle part ou un
 * navigateur puisse l atteindre.
 */
create or replace function public.instance_config()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb := '{}'::jsonb;
  row_setting record;
  secret_value text;
begin
  for row_setting in select * from public.instance_settings where is_set loop
    if row_setting.is_secret then
      select s.decrypted_secret into secret_value
      from vault.decrypted_secrets s
      where s.name = public.instance_secret_name(row_setting.key);
    else
      secret_value := row_setting.value;
    end if;

    if secret_value is not null then
      result := result || jsonb_build_object(row_setting.key, secret_value);
    end if;
  end loop;

  return result;
end;
$$;

revoke all on function public.instance_config() from public, anon, authenticated;
grant execute on function public.instance_config() to service_role;

comment on function public.instance_config() is
  'Reglages d instance destines aux fonctions edge, secrets Vault resolus. Accordee au seul service_role.';

/*
 * Le seau journalier, reclame avant d ouvrir la session SMTP.
 *
 * Rend `false` quand le plafond est atteint, et l appelant s arrete la. Compte avant d envoyer et
 * non apres : un envoi qui echoue a mi-parcours a quand meme sollicite le relais, et c est ce que
 * le plafond borne.
 */
create or replace function public.claim_instance_mail(amount integer default 1)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  daily_cap constant integer := 200;
  accepted boolean;
begin
  insert into public.instance_mail_quota (day, sent)
  values (current_date, amount)
  on conflict (day) do update
    set sent = public.instance_mail_quota.sent + amount
    where public.instance_mail_quota.sent + amount <= daily_cap
  returning true into accepted;

  return coalesce(accepted, false);
end;
$$;

revoke all on function public.claim_instance_mail(integer) from public, anon, authenticated;
grant execute on function public.claim_instance_mail(integer) to service_role;

comment on function public.claim_instance_mail(integer) is
  'Reserve des envois dans le plafond journalier. Rend false quand le plafond est atteint.';

/*
 * L autorisation du courriel de test, et son destinataire.
 *
 * Le destinataire ne se saisit pas : c est l adresse du compte qui clique. Un champ libre aurait
 * fait de ce bouton un formulaire d envoi anonyme, ce que le plafond seul n aurait pas suffi a
 * rendre inoffensif. L expediteur, lui, vient du reglage et de nulle part ailleurs.
 *
 * `assert_admin_write()` plutot que `is_admin()` : ce bouton fait sortir un message de l instance,
 * c est une action et non une lecture.
 */
create or replace function public.begin_instance_mail_test()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient text;
begin
  perform public.assert_admin_write();

  select u.email into recipient from auth.users u where u.id = (select auth.uid());

  if recipient is null then
    raise exception 'adresse de destination introuvable' using errcode = '22023';
  end if;

  if not public.claim_instance_mail(1) then
    raise exception 'plafond d envoi atteint' using errcode = '53400';
  end if;

  return recipient;
end;
$$;

revoke all on function public.begin_instance_mail_test() from public, anon, authenticated;
grant execute on function public.begin_instance_mail_test() to authenticated;

comment on function public.begin_instance_mail_test() is
  'Autorise un courriel de test et rend l adresse du compte appelant. Exige aal2 et consomme le plafond.';
