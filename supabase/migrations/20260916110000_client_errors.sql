-- Un plantage silencieux laisse desormais une trace, et elle reste a la maison.
--
-- Le seul signal de bug aujourd hui est volontaire : quelqu un ouvre le panneau de signalement et
-- ecrit. Une erreur JavaScript non rattrapee, elle, ne remonte nulle part — l ecran se fige, la
-- personne ferme l application, et le bug survit des mois.
--
-- POURQUOI PAS SENTRY, NI AUCUN SERVICE TIERS. Une pile d appels porte des chemins de route, des
-- messages d erreur rediges par nos propres fonctions, parfois le nom d une liste dans un refus
-- de contrainte. Envoyer cela chez un editeur exterieur reviendrait a lui confier, en continu et
-- sans que personne l ait demande, des fragments de la vie domestique de familles entieres. Ce
-- depot a deja refuse le geocodage inverse pour cette exacte raison (voir shop_place) : on ne
-- sort pas une donnee de la maison parce que c est pratique. Et il n y a rien a gagner ici — le
-- projet a deja un Postgres, un panneau d administration, une table de signalements et une
-- discipline RLS eprouvee. Un service tiers apporterait un tableau de bord et un contrat de
-- sous-traitance ; la table ci-dessous apporte le tableau de bord sans le contrat.
--
-- CE QUI EST STOCKE, ET CE QUI NE PEUT PAS L ETRE. Le client nettoie avant d envoyer : adresses
-- de courriel, identifiants UUID, chaines de requete, jetons, chemins de fichiers personnels et
-- longues suites de chiffres sont remplaces par des marqueurs (voir src/lib/domain/crash.ts). Ce
-- qu on ne peut PAS nettoyer, et il faut le dire franchement : le texte libre d une `Error`. Une
-- bibliotheque — ou notre propre code — peut y avoir recopie le nom d une liste, d un magasin ou
-- d un article. Aucune regle d expression reguliere ne distingue « Pique-nique de mamie » d un
-- mot technique. D ou le plafond de 500 caracteres sur le message, la retention courte, et le
-- fait que l ecran d administration ne montre JAMAIS qui a plante : seulement combien de comptes.
-- Un signalement est volontaire, son auteur accepte d etre nomme ; un plantage ne l est pas.
--
-- DEDUPLICATION. Une boucle qui leve cinq cents fois la meme erreur ne doit pas ecrire cinq cents
-- lignes. Le client calcule une empreinte stable (source, message normalise, premiere image de la
-- pile sans numero de ligne) et la base fait un upsert sur (compte, empreinte) : une ligne par
-- erreur distincte et par compte, avec un compteur. Par compte et non globalement, pour que
-- « combien de personnes sont touchees » reste lisible sans jamais stocker qui.
--
-- Une erreur resolue qui reparait rouvre sa ligne. Sans cela, un bug classe trop vite redeviendrait
-- invisible alors meme qu il continue de casser des ecrans tous les jours.
--
-- VOLUME. Deux plafonds sur la meme fenetre de vingt-quatre heures glissantes, comme pour les
-- signalements, mais ils ne ferment pas la meme chose. Cinquante empreintes NOUVELLES par compte
-- et par jour : c est le seul plafond qui borne le stockage, puisque seule une empreinte inedite
-- cree une ligne. Une application qui plante de cinquante facons differentes dans la meme journee
-- a des problemes que ce fichier ne reglera pas. Et trente secondes entre deux incrementations de
-- la meme empreinte : le client se retient deja, mais le client est du code qu on peut contourner,
-- et sans ce second garde-fou une boucle appellerait la fonction en continu. Le cout en stockage
-- reste modeste — 4,5 ko au pire par ligne, contre 1,5 Mo pour une capture d ecran de
-- signalement — donc c est le nombre d appels, pas les octets, qu on borne ici.
--
-- RETENTION. Trente jours. Une erreur est un diagnostic, pas une archive : passe un mois, soit
-- elle a ete corrigee, soit elle s est reproduite et sa ligne a ete rafraichie. Le nettoyage se
-- fait a chaque appel de report_crash, comme redeem_invite nettoie ses tentatives — pas de tache
-- planifiee a surveiller, et rien ne grossit quand rien ne plante. La lecture d administration
-- filtre sur la meme fenetre, pour que l ecran ne montre jamais au-dela de la retention annoncee
-- meme si aucun nettoyage n a tourne depuis longtemps.
--
-- SESSION AUTHENTIFIEE, PAS COMPTE APPROUVE. Toutes les autres ecritures passent par
-- `is_approved()`. Pas celle-ci, et c est delibere : un compte en attente de validation voit
-- l ecran d attente, et si c est LUI qui plante, personne ne le saura jamais — cette personne n a
-- meme pas acces au formulaire de signalement. Le risque pris est nul en comparaison : la fonction
-- n est accordee qu a `authenticated`, elle ne rend aucune donnee, et les memes plafonds
-- s appliquent.
--
-- La fonction ne leve pas quand un plafond est atteint, pour la meme raison que submit_bug_report :
-- une exception annulerait la transaction. Ici elle annulerait le nettoyage de retention et
-- l incrementation du compteur. Elle renvoie un objet decrivant l issue. Et de toute facon rien de
-- ce qu elle renvoie n arrive sous les yeux de qui que ce soit : le rapporteur cote client avale
-- tout. Une panne du rapporteur d erreurs ne doit jamais devenir, elle-meme, une erreur visible.

create table public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  fingerprint text not null check (char_length(fingerprint) between 1 and 64),
  source text not null check (source in ('window', 'promise', 'render', 'sync')),
  -- 500 caracteres : de quoi lire un message d erreur entier, pas de quoi recevoir un document.
  message text not null check (char_length(message) between 1 and 500),
  stack text check (stack is null or char_length(stack) <= 4000),
  path text,
  user_agent text,
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_at timestamptz
);

-- La cle de deduplication. `user_id` peut devenir null si le compte est supprime : les null sont
-- distincts pour un index unique, donc ces lignes orphelines cessent simplement de se regrouper.
-- Elles ne sont plus jamais mises a jour et la retention les emporte.
create unique index client_errors_user_print on public.client_errors (user_id, fingerprint);

create index client_errors_recent on public.client_errors (last_seen_at desc);

alter table public.client_errors enable row level security;

-- Aucune policy : comme bug_reports, la table ne s ouvre que par les fonctions security definer
-- ci-dessous. Personne ne peut relire les plantages des autres, ni effacer les siens pour se
-- refaire un quota.
revoke all on public.client_errors from public, anon, authenticated;

create or replace function public.report_crash(
  fingerprint text,
  source text,
  message text,
  stack text,
  path text,
  user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
  existing public.client_errors;
  fresh_count integer;
begin
  author := (select auth.uid());

  if author is null then
    return jsonb_build_object('status', 'ignored');
  end if;

  if source not in ('window', 'promise', 'render', 'sync') then
    return jsonb_build_object('status', 'ignored');
  end if;

  -- Un message vide ne renseigne personne et ne merite pas une ligne. Le client ne devrait jamais
  -- en envoyer, mais la fonction est appelable sans passer par lui.
  if coalesce(trim(message), '') = '' or coalesce(trim(fingerprint), '') = '' then
    return jsonb_build_object('status', 'ignored');
  end if;

  delete from public.client_errors
  where last_seen_at < now() - interval '30 days';

  select * into existing
  from public.client_errors e
  where e.user_id = author and e.fingerprint = report_crash.fingerprint
  for update;

  if existing.id is not null then
    -- Le meme plantage, revu trop vite : on ne reecrit pas la ligne. Trente secondes suffisent a
    -- distinguer « ca recommence » d une boucle qui part en vrille.
    if existing.last_seen_at > now() - interval '30 seconds' then
      return jsonb_build_object('status', 'throttled');
    end if;

    update public.client_errors e
    set occurrences = e.occurrences + 1,
        last_seen_at = now(),
        path = coalesce(nullif(report_crash.path, ''), e.path),
        -- Une erreur classee qui reparait se rouvre : sinon un bug resolu trop vite continue de
        -- casser des ecrans sans jamais remonter a l ecran d administration.
        status = 'open',
        resolved_at = null
    where e.id = existing.id;

    return jsonb_build_object('status', 'recorded');
  end if;

  select count(*) into fresh_count
  from public.client_errors e
  where e.user_id = author
    and e.first_seen_at > now() - interval '24 hours';

  if fresh_count >= 50 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.client_errors (
    user_id, fingerprint, source, message, stack, path, user_agent
  )
  values (
    author,
    report_crash.fingerprint,
    report_crash.source,
    left(report_crash.message, 500),
    left(nullif(report_crash.stack, ''), 4000),
    nullif(report_crash.path, ''),
    nullif(report_crash.user_agent, '')
  );

  return jsonb_build_object('status', 'recorded');
end;
$$;

revoke all on function public.report_crash(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.report_crash(text, text, text, text, text, text) to authenticated;

/*
 * La lecture d administration, groupee par empreinte.
 *
 * Aucune adresse de courriel, contrairement a list_bug_reports, et c est la difference de fond
 * entre les deux ecrans : un signalement est ecrit volontairement par quelqu un qui accepte d etre
 * rappele, un plantage arrive sans qu on le decide. On rend donc le nombre de comptes touches, qui
 * est l information utile pour prioriser, et rien qui designe une personne.
 *
 * Le message et la pile retenus sont ceux de l occurrence la plus recente : a empreinte egale ils
 * ne different que par des details deja nettoyes, et prendre le plus recent evite d afficher une
 * pile issue d une version du code qui n existe plus.
 */
create or replace function public.list_client_errors()
returns table (
  fingerprint text,
  source text,
  message text,
  stack text,
  path text,
  user_agent text,
  occurrences bigint,
  people bigint,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (e.fingerprint)
    e.fingerprint,
    e.source,
    e.message,
    e.stack,
    e.path,
    e.user_agent,
    sum(e.occurrences) over (partition by e.fingerprint),
    count(*) over (partition by e.fingerprint),
    min(e.first_seen_at) over (partition by e.fingerprint),
    max(e.last_seen_at) over (partition by e.fingerprint),
    case
      when bool_or(e.status = 'open') over (partition by e.fingerprint) then 'open'
      else 'resolved'
    end
  from public.client_errors e
  where public.is_admin()
    and e.last_seen_at > now() - interval '30 days'
  order by e.fingerprint, e.last_seen_at desc
$$;

revoke all on function public.list_client_errors() from public, anon, authenticated;
grant execute on function public.list_client_errors() to authenticated;

-- Le classement porte sur l empreinte, pas sur une ligne : c est le bug qu on declare corrige, et
-- il a une ligne par compte touche.
create or replace function public.resolve_client_error(target text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin_write();

  update public.client_errors
  set status = 'resolved', resolved_at = now()
  where fingerprint = target and status = 'open';
end;
$$;

revoke all on function public.resolve_client_error(text) from public, anon, authenticated;
grant execute on function public.resolve_client_error(text) to authenticated;

comment on table public.client_errors is
  'Plantages JavaScript non rattrapes, nettoyes cote client puis dedupliques par (compte, empreinte). Retention de trente jours, appliquee a chaque appel de report_crash.';

comment on column public.client_errors.fingerprint is
  'Empreinte stable calculee par le client (src/lib/domain/crash.ts) : source, message normalise et premiere image de la pile sans numero de ligne.';

comment on function public.report_crash(text, text, text, text, text, text) is
  'Enregistre un plantage sous deux plafonds : cinquante empreintes inedites par compte et par jour, et trente secondes entre deux occurrences d une meme empreinte. Ne leve jamais.';
