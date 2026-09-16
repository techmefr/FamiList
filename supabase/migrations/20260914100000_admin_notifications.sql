-- L administrateur est prevenu par courriel des inscriptions et des signalements.
--
-- Les deux evenements partagent le meme probleme : ils n existent que dans /admin, et personne ne
-- regarde /admin en continu. Une inscription y est pire qu un signalement — le compte arrive en
-- `pending`, et les trois fonctions d acces exigent `is_approved()` : la personne se connecte et
-- ne voit rien, sans savoir qu elle attend une validation humaine. Une seule brique sert les deux.
--
-- L application est un bundle statique : il n y a pas de serveur a nous ou poser un envoi de mail.
-- Le chemin est donc base de donnees -> Edge Function. Trois pieces, volontairement decouplees :
--
--   1. Un tampon (`admin_notifications`) que les declencheurs remplissent. Un declencheur qui
--      ferait l appel reseau lui-meme mettrait la latence — et l echec — du relais de courriel
--      dans la transaction d inscription : une panne du relais refuserait des inscriptions. Ici le
--      declencheur ne fait qu un insert local, et son bloc `exception when others` avale meme
--      celui-la. Une inscription et un signalement aboutissent quoi qu il arrive au courriel.
--   2. Une fonction d envoi (`flush_admin_notifications`) appelee toutes les cinq minutes par
--      pg_cron, qui reveille l Edge Function via pg_net.
--   3. L Edge Function `notify-admins`, qui reclame le tampon et envoie UN courriel groupe.
--
-- Cinq minutes et un courriel groupe, plutot qu un courriel par evenement : une mauvaise journee
-- de signalements ne doit pas produire quarante courriels, sinon le quarante-et-unieme n est plus
-- lu. Cinq minutes restent un delai que quelqu un qui vient de s inscrire ne percoit pas comme un
-- oubli. Le groupage est gratuit — il tombe tout seul du fait que la fonction vide le tampon.
--
-- Qui est « l administrateur » ? Tous les comptes `role = 'admin'` et `status = 'approved'`, pas
-- une adresse en dur. Le depot n en connait qu un aujourd hui, et l issue #11 dit justement que
-- c est un point de defaillance unique : le jour ou un second administrateur est nomme, il doit
-- recevoir les courriels sans qu on repasse par une migration. S il n y a aucun administrateur,
-- rien n est reclame et le tampon attend.
--
-- Ces courriels ne peuvent pas passer par le SMTP deja configure cote Supabase : celui-la n est
-- consomme que par Supabase Auth, pour ses propres messages (confirmation, reinitialisation,
-- invitation). Prevenir un administrateur qu une inscription attend n est aucun de ces messages,
-- et Auth n offre pas d envoi arbitraire. D ou un chemin d envoi a nous dans l Edge Function, qui
-- parle au relais directement — les memes identifiants peuvent le servir, ils doivent juste lui
-- etre donnes une seconde fois, en secrets de fonction.
--
-- Rien de secret ici. L URL des fonctions et la cle de service vivent dans Supabase Vault, les
-- identifiants SMTP dans les secrets de l Edge Function. Absents — et ils le sont en CI comme sur
-- une base neuve — chaque etage se contente de ne rien faire : le cron ne poste pas, la fonction
-- relache ce qu elle avait reclame. Aucun secret n est requis pour que `db reset` passe.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('signup', 'bug_report')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz
);

create index admin_notifications_pending_idx
  on public.admin_notifications (created_at)
  where sent_at is null;

alter table public.admin_notifications enable row level security;

-- Aucune policy, comme bug_reports : la table ne s atteint que par les fonctions security definer
-- ci-dessous. Le tampon recopie une adresse de courriel, il n a rien a faire dans l API publique.
revoke all on public.admin_notifications from public, anon, authenticated;

comment on table public.admin_notifications is
  'Tampon des evenements a signaler aux administrateurs par courriel. Rempli par des declencheurs, vide toutes les cinq minutes par un courriel groupe.';
comment on column public.admin_notifications.claimed_at is
  'Pose au moment ou l Edge Function prend la ligne en charge. Repasse a null si l envoi echoue, et une reclamation de plus de cinq minutes est consideree perdue et reprise.';

create or replace function public.enqueue_signup_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Seuls les comptes qui attendent vraiment une decision. Le tout premier compte est cree
  -- `approved` par handle_new_user, et le compte de demonstration aussi : signaler ces deux-la
  -- reviendrait a demander une validation qui a deja eu lieu.
  if new.status <> 'pending' or new.is_demo then
    return new;
  end if;

  insert into public.admin_notifications (kind, payload)
  values (
    'signup',
    jsonb_build_object(
      'profile_id', new.id,
      'display_name', new.display_name,
      'email', (select u.email::text from auth.users u where u.id = new.id)
    )
  );

  return new;
exception
  when others then
    -- Une inscription ne se perd jamais pour un courriel. L evenement manquera au tampon, le
    -- compte restera visible dans /admin : le pire cas est celui d avant cette migration.
    return new;
end;
$$;

create trigger profiles_notify_admins
  after insert on public.profiles
  for each row execute function public.enqueue_signup_notification();

create or replace function public.enqueue_bug_report_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_notifications (kind, payload)
  values (
    'bug_report',
    jsonb_build_object(
      'report_id', new.id,
      'report_kind', new.kind,
      'path', new.path,
      -- La description entiere peut monter a quatre mille caracteres, et la capture a un megaoctet
      -- et demi de base64 : ni l une ni l autre n a sa place dans un courriel de reveil. Le
      -- courriel dit qu il y a quelque chose a lire, /admin le donne en entier.
      'excerpt', left(new.description, 300),
      'has_screenshot', new.screenshot is not null,
      'email', (select u.email::text from auth.users u where u.id = new.user_id)
    )
  );

  return new;
exception
  when others then
    return new;
end;
$$;

create trigger bug_reports_notify_admins
  after insert on public.bug_reports
  for each row execute function public.enqueue_bug_report_notification();

create or replace function public.claim_admin_notifications()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipients jsonb;
  claimed jsonb;
begin
  select coalesce(jsonb_agg(u.email::text order by u.email), '[]'::jsonb)
  into recipients
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'admin' and p.status = 'approved' and u.email is not null;

  if recipients = '[]'::jsonb then
    return jsonb_build_object('recipients', recipients, 'notifications', '[]'::jsonb);
  end if;

  -- Purge d abord : une ligne envoyee ne sert plus qu a garder une adresse en base.
  delete from public.admin_notifications
  where sent_at is not null and sent_at < now() - interval '30 days';

  with picked as (
    update public.admin_notifications n
    set claimed_at = now()
    where n.id in (
      select c.id
      from public.admin_notifications c
      where c.sent_at is null
        and (c.claimed_at is null or c.claimed_at < now() - interval '5 minutes')
      order by c.created_at
      limit 100
      for update skip locked
    )
    returning n.id, n.kind, n.payload, n.created_at
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', p.id, 'kind', p.kind, 'payload', p.payload, 'createdAt', p.created_at)
      order by p.created_at
    ),
    '[]'::jsonb
  )
  into claimed
  from picked p;

  return jsonb_build_object('recipients', recipients, 'notifications', claimed);
end;
$$;

create or replace function public.mark_admin_notifications_sent(ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.admin_notifications
  set sent_at = now()
  where id = any(ids) and sent_at is null;
$$;

create or replace function public.release_admin_notifications(ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.admin_notifications
  set claimed_at = null
  where id = any(ids) and sent_at is null;
$$;

revoke all on function public.claim_admin_notifications() from public, anon, authenticated;
revoke all on function public.mark_admin_notifications_sent(uuid[]) from public, anon, authenticated;
revoke all on function public.release_admin_notifications(uuid[]) from public, anon, authenticated;
grant execute on function public.claim_admin_notifications() to service_role;
grant execute on function public.mark_admin_notifications_sent(uuid[]) to service_role;
grant execute on function public.release_admin_notifications(uuid[]) to service_role;

create or replace function public.flush_admin_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  functions_url text;
  service_key text;
begin
  if not exists (select 1 from public.admin_notifications where sent_at is null) then
    return;
  end if;

  select s.decrypted_secret into functions_url
  from vault.decrypted_secrets s
  where s.name = 'admin_notifications_functions_url';

  select s.decrypted_secret into service_key
  from vault.decrypted_secrets s
  where s.name = 'admin_notifications_service_key';

  -- Sans secrets, on ne tente rien. C est le cas en CI et sur une base neuve : le cron tourne
  -- toutes les cinq minutes sans produire ni requete sortante ni erreur dans les journaux.
  if functions_url is null or service_key is null then
    return;
  end if;

  perform net.http_post(
    url := functions_url || '/notify-admins',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb,
    -- Les cinq secondes par defaut de pg_net ne suffisent pas : la fonction doit encore ouvrir une
    -- session SMTP avec le relais. On ne lit pas la reponse de toute facon — c est le tampon qui
    -- dit ce qui est parti — mais un abandon a cinq secondes couperait l envoi en cours.
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.flush_admin_notifications() from public, anon, authenticated;

comment on function public.flush_admin_notifications() is
  'Reveille l Edge Function notify-admins si le tampon n est pas vide et si les secrets Vault sont poses. Ne leve jamais et n envoie rien elle-meme.';

do $$
begin
  perform cron.unschedule('familist-admin-notifications')
  where exists (select 1 from cron.job where jobname = 'familist-admin-notifications');

  perform cron.schedule(
    'familist-admin-notifications',
    '*/5 * * * *',
    $cron$select public.flush_admin_notifications()$cron$
  );
end;
$$;
