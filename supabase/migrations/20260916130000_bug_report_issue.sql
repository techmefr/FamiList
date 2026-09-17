-- Un signalement porte un numero court, et peut etre publie dans le suivi du depot.
--
-- Deux manques se repondent. D un cote `bug_reports.id` est un uuid : on ne le lit pas, on ne le
-- dit pas au telephone, on ne le met pas dans un titre. De l autre les signalements n existent que
-- dans /admin, alors que le travail, lui, se suit dans les issues du depot.
--
-- Ce que l issue contient, et surtout ce qu elle ne contient pas.
--
-- Le depot est public. `description` fait jusqu a quatre mille caracteres de texte libre ou
-- quelqu un peut ecrire son nom ou celui d un proche ; `screenshot` jusqu a un megaoctet et demi
-- de JPEG montrant les vraies listes du foyer, les prenoms des membres et leurs avatars ; `path`
-- peut porter l identifiant d une liste et `user_agent` une empreinte d appareil. Recopier tout
-- cela demanderait un filtre d anonymisation, et aucun filtre automatique ne rattrape un prenom
-- ecrit au milieu d une phrase. L issue ne porte donc qu un numero : « Signalement 42 — a traiter
-- dans /admin ». Il n y a plus rien a anonymiser, parce qu il n y a plus rien qui sorte. Le
-- contenu reste en base, derriere l ecran d administration.
--
-- La publication est demandee a la main depuis /admin, jamais automatique.
--
-- Automatique, le suivi refleterait la realite sans effort — mais tout compte approuve pourrait
-- alors ecrire dans un depot public. Le plafond pose par la migration 20260913110000 borne a vingt
-- signalements par jour et par compte : c est vingt issues publiques par jour et par compte, et le
-- depot n a aucun moyen de les retirer. Une issue qui ne dit qu un numero n est de toute facon
-- actionnable que par un administrateur, qui a deja ete prevenu par le courriel de la migration
-- 20260914100000 : la publier automatiquement ne lui apprendrait rien qu il ne sache. Elle sert de
-- trace dans le backlog, et c est au tri qu on decide si un signalement merite cette trace.
--
-- Le chemin d appel reprend celui de `notify-admins`, sans en inventer un second : le jeton GitHub
-- est un jeton d ecriture, il ne peut pas partir dans un bundle client. L administrateur pose une
-- demande (un simple update local, qui ne peut pas echouer sur une panne de GitHub), pg_cron
-- reveille chaque minute la fonction edge via pg_net, et la fonction edge rappelle la base avec le
-- numero d issue obtenu. Sans secrets Vault — c est le cas en CI et sur une base neuve — le reveil
-- ne poste rien et n ecrit aucune erreur : `db reset` passe sans le moindre identifiant.

-- Le numero est porte par une sequence et non par un `count(*)` : deux signalements simultanes
-- recevraient le meme numero, et un signalement efface decalerait tous les suivants. Une sequence
-- ne recule jamais, meme si la transaction qui l a consommee est annulee — un trou dans la suite
-- coute moins qu un numero reattribue a un autre signalement.
create sequence public.bug_report_number_seq;

alter table public.bug_reports
  add column number bigint,
  add column issue_number integer,
  add column issue_url text,
  add column issue_requested_at timestamptz,
  add column issue_claimed_at timestamptz,
  add column issue_published_at timestamptz;

-- Les signalements deja deposes sont numerotes dans leur ordre d arrivee, pour que le numero dise
-- quelque chose d une lecture chronologique et ne soit pas un ordre de reecriture de table.
with ordonnes as (
  select id, row_number() over (order by created_at, id) as rang
  from public.bug_reports
)
update public.bug_reports r
set number = o.rang
from ordonnes o
where o.id = r.id;

select setval(
  'public.bug_report_number_seq',
  coalesce((select max(number) from public.bug_reports), 0) + 1,
  false
);

alter table public.bug_reports
  alter column number set default nextval('public.bug_report_number_seq'),
  alter column number set not null,
  add constraint bug_reports_number_key unique (number);

alter sequence public.bug_report_number_seq owned by public.bug_reports.number;

create index bug_reports_issue_pending_idx
  on public.bug_reports (issue_requested_at)
  where issue_requested_at is not null and issue_number is null;

comment on column public.bug_reports.number is
  'Numero court et stable, dit a la personne qui signale et repris dans le titre de l issue publique.';
comment on column public.bug_reports.issue_number is
  'Numero de l issue ouverte dans le suivi du depot. Non nul, le signalement ne sera pas republie.';
comment on column public.bug_reports.issue_requested_at is
  'Pose par un administrateur depuis /admin. Une demande en attente est reprise a chaque reveil du cron.';

-- Le numero revient a la personne qui vient de signaler : c est la seule reference qu elle pourra
-- citer si elle nous reecrit, et elle n a acces a rien d autre de sa propre ligne.
create or replace function public.submit_bug_report(
  description text,
  screenshot text,
  path text,
  user_agent text,
  kind text default 'bug'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_id uuid;
  inserted_number bigint;
  recent_count integer;
  recent_bytes bigint;
begin
  if not public.is_approved() then
    raise exception 'reserve aux comptes approuves' using errcode = '42501';
  end if;

  if kind not in ('bug', 'suggestion') then
    raise exception 'type de signalement invalide: %', kind using errcode = '22023';
  end if;

  select count(*), coalesce(sum(char_length(r.screenshot)), 0)
  into recent_count, recent_bytes
  from public.bug_reports r
  where r.user_id = (select auth.uid())
    and r.created_at > now() - interval '24 hours';

  if recent_count >= 20 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  if nullif(screenshot, '') is not null
    and recent_bytes + char_length(screenshot) > 12000000
  then
    return jsonb_build_object('status', 'storage_limited');
  end if;

  -- L alias evite que `number` du RETURNING soit lu comme une variable du bloc plutot que comme la
  -- colonne : la table s y nomme `inserted`, et la colonne se qualifie.
  insert into public.bug_reports as inserted
    (user_id, description, screenshot, path, user_agent, kind)
  values ((select auth.uid()), description, nullif(screenshot, ''), nullif(path, ''), user_agent, kind)
  returning inserted.id, inserted.number into inserted_id, inserted_number;

  return jsonb_build_object('status', 'submitted', 'id', inserted_id, 'number', inserted_number);
end;
$$;

comment on function public.submit_bug_report(text, text, text, text, text) is
  'Depose un signalement sous deux plafonds par compte sur vingt-quatre heures glissantes : vingt signalements et douze megaoctets de captures. Renvoie un objet decrivant l issue, numero court compris, plutot que de lever.';

-- Changement du type de retour (colonnes ajoutees) : create or replace le refuse.
drop function if exists public.list_bug_reports();

create or replace function public.list_bug_reports()
returns table (
  id uuid,
  number bigint,
  email text,
  description text,
  screenshot text,
  path text,
  user_agent text,
  kind text,
  status text,
  created_at timestamptz,
  issue_number integer,
  issue_url text,
  issue_requested_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.number, u.email::text, r.description, r.screenshot, r.path, r.user_agent,
         r.kind, r.status, r.created_at, r.issue_number, r.issue_url, r.issue_requested_at
  from public.bug_reports r
  left join auth.users u on u.id = r.user_id
  where public.is_admin()
  order by r.created_at desc
$$;

revoke all on function public.list_bug_reports() from public;
grant execute on function public.list_bug_reports() to authenticated;

-- La demande ne fait qu un update local. Rien ici ne parle a GitHub : un depot injoignable doit
-- laisser le bouton repondre, et la demande sera reprise au reveil suivant.
create or replace function public.request_bug_report_issue(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'reserve aux administrateurs' using errcode = '42501';
  end if;

  update public.bug_reports
  set issue_requested_at = now()
  where id = target
    and issue_number is null
    and issue_requested_at is null;
end;
$$;

revoke all on function public.request_bug_report_issue(uuid) from public;
grant execute on function public.request_bug_report_issue(uuid) to authenticated;

-- Ce que la fonction edge recoit : un numero et une sorte, rien d autre. Le jour ou quelqu un se
-- tromperait de destination, il n y aurait toujours rien a y lire.
create or replace function public.claim_bug_report_issues()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with picked as (
    update public.bug_reports r
    set issue_claimed_at = now()
    where r.id in (
      select c.id
      from public.bug_reports c
      where c.issue_requested_at is not null
        and c.issue_number is null
        and (c.issue_claimed_at is null or c.issue_claimed_at < now() - interval '5 minutes')
      order by c.issue_requested_at
      limit 20
      for update skip locked
    )
    returning r.id, r.number, r.kind, r.issue_requested_at
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', p.id, 'number', p.number, 'kind', p.kind)
      order by p.issue_requested_at
    ),
    '[]'::jsonb
  )
  from picked p;
$$;

create or replace function public.mark_bug_report_issue(
  target uuid,
  issue_number integer,
  issue_url text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.bug_reports r
  set issue_number = mark_bug_report_issue.issue_number,
      issue_url = mark_bug_report_issue.issue_url,
      issue_published_at = now(),
      issue_claimed_at = null
  where r.id = target and r.issue_number is null;
$$;

create or replace function public.release_bug_report_issues(ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.bug_reports
  set issue_claimed_at = null
  where id = any(ids) and issue_number is null;
$$;

revoke all on function public.claim_bug_report_issues() from public, anon, authenticated;
revoke all on function public.mark_bug_report_issue(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.release_bug_report_issues(uuid[]) from public, anon, authenticated;
grant execute on function public.claim_bug_report_issues() to service_role;
grant execute on function public.mark_bug_report_issue(uuid, integer, text) to service_role;
grant execute on function public.release_bug_report_issues(uuid[]) to service_role;

create or replace function public.flush_bug_report_issues()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  functions_url text;
  service_key text;
begin
  if not exists (
    select 1 from public.bug_reports
    where issue_requested_at is not null and issue_number is null
  ) then
    return;
  end if;

  -- Les memes deux secrets que le reveil de `notify-admins` : ils designent l URL des fonctions du
  -- projet et sa cle de service, pas un usage particulier. En redemander une copie sous un autre
  -- nom ne ferait qu ajouter un endroit ou se tromper.
  select s.decrypted_secret into functions_url
  from vault.decrypted_secrets s
  where s.name = 'admin_notifications_functions_url';

  select s.decrypted_secret into service_key
  from vault.decrypted_secrets s
  where s.name = 'admin_notifications_service_key';

  if functions_url is null or service_key is null then
    return;
  end if;

  perform net.http_post(
    url := functions_url || '/publish-report-issues',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.flush_bug_report_issues() from public, anon, authenticated;

comment on function public.flush_bug_report_issues() is
  'Reveille l Edge Function publish-report-issues s il reste une demande de publication et si les secrets Vault sont poses. Ne leve jamais et ne parle a personne elle-meme.';

-- Chaque minute, et non toutes les cinq comme le courriel : ici quelqu un vient de cliquer et
-- regarde l ecran. Le travail est nul tant qu aucune demande n attend, la requete ne partant que
-- derriere le `exists` ci-dessus.
do $$
begin
  perform cron.unschedule('familist-bug-report-issues')
  where exists (select 1 from cron.job where jobname = 'familist-bug-report-issues');

  perform cron.schedule(
    'familist-bug-report-issues',
    '* * * * *',
    $cron$select public.flush_bug_report_issues()$cron$
  );
end;
$$;
