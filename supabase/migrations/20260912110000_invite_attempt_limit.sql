-- Un code d invitation ne se devine plus a la chaine.
--
-- redeem_invite etait appelable sans aucune limite. Le code fait six caracteres dans un alphabet
-- de trente-deux, soit un milliard de combinaisons : c est long, mais un script qui tourne des
-- semaines finit par tomber dessus, et il suffit de tomber sur un seul code vivant pour entrer
-- dans la maison de quelqu un, voir ses courses et ses cartes de fidelite. Une invitation vit
-- sept jours ; multipliee par le nombre d invitations ouvertes a un instant donne, la fenetre
-- n est plus theorique.
--
-- On compte par COMPTE, pas par code. Verrouiller un code apres N echecs donnerait a n importe
-- qui le moyen d empecher une famille de se rejoindre : il lui suffirait de saisir des codes au
-- hasard jusqu a griller celui que la personne attend. Le deni de service serait plus facile a
-- monter que la force brute qu on cherche a arreter. Le compte, lui, n est pas une ressource
-- qu un tiers peut atteindre : redeem_invite exige deja une session approuvee, et personne ne
-- peut consommer les essais de quelqu un d autre. L adresse IP, elle, n existe pas ici — il n y
-- a pas de service intermediaire, l application est un paquet statique qui parle a Postgres.
--
-- Dix echecs par quart d heure glissant : large pour qui recopie un code a la main et se trompe,
-- etroit pour un script, qui plafonne alors a un millier d essais par jour et par compte —
-- negligeable devant le milliard de combinaisons. Un succes efface l ardoise.
--
-- La fonction ne leve plus d exception quand le code est refuse, et c est le point delicat : une
-- exception annule toute la transaction, donc aussi l ecriture de la tentative ratee. Le compteur
-- n aurait jamais rien retenu. Elle renvoie desormais un objet qui dit ce qui s est passe, et
-- l ecriture survit. Les refus qui ne concernent pas le code — compte non valide — continuent de
-- lever, ils ne comptent pour rien.

create table public.invite_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  attempted_at timestamptz not null default now()
);

create index invite_attempts_user_time on public.invite_attempts (user_id, attempted_at desc);

-- Aucune policy, aucun grant : la table n est lisible et modifiable que par redeem_invite, qui
-- est security definer. Laisser un compte effacer ses propres tentatives reviendrait a lui
-- rendre la limite facultative.
alter table public.invite_attempts enable row level security;

drop function if exists public.redeem_invite(text);

create or replace function public.redeem_invite(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.household_invites;
  failures integer;
begin
  if not public.is_approved() then
    raise exception 'compte non valide' using errcode = '42501';
  end if;

  perform public.lock_household_membership();

  delete from public.invite_attempts
  where user_id = (select auth.uid())
    and attempted_at < now() - interval '15 minutes';

  select count(*) into failures
  from public.invite_attempts
  where user_id = (select auth.uid());

  if failures >= 10 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  select * into invite
  from public.household_invites
  where code = upper(trim(invite_code))
  for update;

  -- Toujours la meme reponse pour un code inconnu, deja consomme ou perime : distinguer les trois
  -- dirait a un script lequel de ses essais a touche un code existant.
  if invite is null or invite.used_by is not null or invite.expires_at < now() then
    insert into public.invite_attempts (user_id) values ((select auth.uid()));
    return jsonb_build_object('status', 'invalid');
  end if;

  delete from public.invite_attempts where user_id = (select auth.uid());

  if exists (
    select 1 from public.household_members
    where household_id = invite.household_id and user_id = (select auth.uid())
  ) then
    return jsonb_build_object('status', 'joined', 'household_id', invite.household_id);
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (invite.household_id, (select auth.uid()), 'member');

  update public.household_invites
  set used_by = (select auth.uid()), used_at = now()
  where code = invite.code;

  return jsonb_build_object('status', 'joined', 'household_id', invite.household_id);
end;
$$;

revoke all on function public.redeem_invite(text) from public;
grant execute on function public.redeem_invite(text) to authenticated;

comment on table public.invite_attempts is
  'Essais d invitation rates, par compte, sur une fenetre glissante. Nettoyee a chaque appel de redeem_invite.';
