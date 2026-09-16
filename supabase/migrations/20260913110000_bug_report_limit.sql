-- Un signalement ne se depose plus en boucle.
--
-- submit_bug_report n avait aucun plafond : un compte approuve pouvait poster sans fin. Le
-- volume de lignes n est pas le vrai danger — l ecran d administration les liste toutes, et
-- quelques milliers de lignes noient le seul signalement qui comptait. Le stockage l est
-- davantage : chaque signalement peut porter une capture jusqu a 1,5 Mo de texte en base, et
-- deux cents captures suffisent a peser plus lourd que tout le reste des donnees de
-- l application reunies.
--
-- D ou deux plafonds sur la meme fenetre de vingt-quatre heures glissantes, et non un seul.
-- Vingt signalements par jour : personne n en ecrit autant de bonne foi, et quelqu un qui
-- traverse une mauvaise journee de bugs n est pas coupe. Douze megaoctets de captures sur la
-- meme fenetre : c est une dizaine de captures pleines, bien au-dela de l usage honnete, et
-- cela borne ce qu un compte peut faire grossir la base en une journee. Sans le second plafond,
-- vingt captures pleines par jour et par compte passeraient encore.
--
-- Pas de table de tentatives ici, contrairement a redeem_invite : ce qu on compte, ce sont des
-- signalements reussis, et chacun laisse deja sa ligne dans bug_reports avec son horodatage et
-- son auteur. Une table parallele repeterait la meme information. bug_reports offre les memes
-- garanties : row level security active, aucune policy, tous les droits revoques — elle n est
-- atteignable que par les fonctions security definer, donc personne ne peut effacer ses propres
-- lignes pour se refaire un quota.
--
-- La fonction ne leve pas d exception quand le plafond est atteint. Une exception annulerait la
-- transaction ; ici elle n effacerait pas de compteur, mais elle laisserait l ecran avec un
-- message technique en anglais venu de Postgres, intraduisible. Elle renvoie donc, comme
-- redeem_invite, un objet qui dit ce qui s est passe, et l interface choisit les mots. Les refus
-- qui ne sont pas des plafonds — compte non approuve, type invalide — continuent de lever.

create index if not exists bug_reports_user_time on public.bug_reports (user_id, created_at desc);

-- Changement du type de retour (uuid vers jsonb) : create or replace le refuse.
drop function if exists public.submit_bug_report(text, text, text, text, text);

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

  -- Le plafond d octets ne ferme que la piece jointe, jamais le signalement : un texte seul ne
  -- coute rien et reste la seule facon de nous joindre. La capture en cours compte dans le
  -- plafond qu elle ferait franchir, sinon le dernier envoi accepte le depasserait de 1,5 Mo.
  if nullif(screenshot, '') is not null
    and recent_bytes + char_length(screenshot) > 12000000
  then
    return jsonb_build_object('status', 'storage_limited');
  end if;

  insert into public.bug_reports (user_id, description, screenshot, path, user_agent, kind)
  values ((select auth.uid()), description, nullif(screenshot, ''), nullif(path, ''), user_agent, kind)
  returning id into inserted_id;

  return jsonb_build_object('status', 'submitted', 'id', inserted_id);
end;
$$;

revoke all on function public.submit_bug_report(text, text, text, text, text) from public;
grant execute on function public.submit_bug_report(text, text, text, text, text) to authenticated;

comment on function public.submit_bug_report(text, text, text, text, text) is
  'Depose un signalement sous deux plafonds par compte sur vingt-quatre heures glissantes : vingt signalements et douze megaoctets de captures. Renvoie un objet decrivant l issue plutot que de lever.';
