-- The instance settings, set from /admin rather than from a terminal.
--
-- Why this file exists. Getting an email out required `supabase secrets set` until now, so a command line, a
-- linked project and an installed CLI. Nobody who is not a developer climbs those three steps, and yet it is
-- that person who hosts their instance. While sending is not configured, `admin_notifications` fills up and
-- nothing leaves: the silence is total and looks like a breakdown. The configuration must therefore be set
-- from the screen, and the screen must say where it stands.
--
-- Why a settings table and not an email table. #137 has just raised the same need for its repository tracker
-- token, and the next migration would invent the same mechanism under another name. So what is set here is a
-- settings holder: a catalogue of known keys, two writes, one read. Email is only its first occupant.
--
-- Why the secret does not live in a column. An SMTP password in the clear in a table, editable from a web
-- page, is an email relay offered to whoever takes over an administrator account. Vault encrypts at rest and
-- only returns the value to a `security definer` function running under the owner account. The repository
-- already uses it for `notify-admins`'s wake-up secrets: nothing new, only one more use.
--
-- Why no function reads the secret back. `instance_settings_read()` is the only read reachable by a client,
-- and it never returns the value of a secret key — only the fact that it is set and the date. Even the
-- administrator who has just typed their password cannot read it back: the screen offers to replace it,
-- never to show it. A tab left open therefore gives nothing away.
--
-- Why the writes go through `assert_admin_write()`. Since #128, every write of the panel requires `aal2`. A
-- permissive RLS policy on `instance_settings` would have opened the door to a session left at the password
-- alone — exactly the scenario where somebody has just stolen an administrator password and is looking for a
-- spam relay.
--
-- Why environment variables keep priority. An instance already configured by `supabase secrets set` — the
-- repository's, in particular — must not break because this migration goes through. So the edge functions
-- read the environment first, the database second, key by key. Nothing to migrate for whoever has nothing to
-- change.
--
-- Why a sending cap and a pinned sender. A compromised administrator account must not become a spam gateway.
-- The sender is not chosen case by case: it comes from the setting, and the test email leaves for the sole
-- address of the account that clicks. The daily cap, for its part, bounds the damage even if everything else
-- falls.

/*
 * The catalogue of known keys, and their value in the clear when they hold nothing secret.
 *
 * The rows are set by this migration and by it alone: `set_instance_setting` refuses an absent key. Without
 * that guardrail, an administrator could write as many secrets into Vault as they like, under whatever names
 * they like — a vault nobody reads back is no longer a vault, it is a tip.
 *
 * `value` always stays `null` on a secret row. The row exists all the same: it carries the date it was set,
 * which is what the screen shows in place of the value.
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

-- No policy: the table is only joined by the `security definer` functions below. RLS enabled with no policy
-- means "nobody", which is exactly the intention.
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
 * The sending counter, one bucket per day.
 *
 * A single row per day, created on the first send: nothing to purge, nothing to schedule, and the table stays
 * readable by eye. The cap is deliberately high for a family instance and low for a spam campaign.
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
 * The secret's name in Vault, derived from the key.
 *
 * Named once rather than copied into three functions: the day one of the three writes `instance-setting-...`
 * instead of `instance_setting_...`, the secret is set and never read back, and the screen shows "configured"
 * over an empty vault.
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
 * What the screen is allowed to know.
 *
 * `value` comes out in the clear for an ordinary key and is always `null` for a secret key — the distinction
 * is made here, in the database, and not in the client: a client can be replaced by a `curl` request.
 *
 * Reading is reserved for `is_admin()` alone, with no `aal2`, like the panel's other reads since #128: an
 * administrator stuck at the first factor must be able to open the screen and understand why they are
 * refused, rather than believe they have lost their role.
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
 * Setting a value.
 *
 * The format checks are here and not only in the screen, because they serve a purpose: a port of 0 or a
 * sender address with no at-sign would produce a silent asynchronous sending failure, two days later, with
 * nobody connecting it to Tuesday's typing.
 *
 * An empty value erases: it is the natural gesture for removing a setting, and it does not need a second
 * button.
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

    -- `value` stays empty: the table must never carry a copy of what Vault encrypts.
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
 * Removing a value.
 *
 * The secret is deleted from Vault and not merely forgotten from the table: an orphan secret in the vault
 * would still be readable by the edge function, and an "erased" setting would go on serving.
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
 * What the edge functions read, secrets included.
 *
 * Granted to `service_role` alone, which lives only in the project's secrets and never in the published
 * bundle. It is the only way out for the secret values, and it goes nowhere a browser can reach.
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
 * The daily bucket, claimed before opening the SMTP session.
 *
 * Returns `false` when the cap is reached, and the caller stops there. It counts before sending and not after:
 * a send that fails halfway has still called on the relay, and that is what the cap bounds.
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
 * The authorisation for the test email, and its recipient.
 *
 * The recipient is not typed in: it is the address of the account that clicks. A free field would have made
 * this button an anonymous sending form, which the cap alone would not have been enough to make harmless. The
 * sender, for its part, comes from the setting and from nowhere else.
 *
 * `assert_admin_write()` rather than `is_admin()`: this button gets a message out of the instance, which is
 * an action and not a read.
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
