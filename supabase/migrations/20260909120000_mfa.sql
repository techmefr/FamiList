-- Deuxieme facteur, codes de secours, et sessions visibles.
--
-- Supabase sait poser un facteur TOTP et elever une session en aal2, mais il ne le rend obligatoire
-- nulle part : sans regle cote base, une session restee en aal1 lit tout, et la 2FA n'est qu'un
-- ecran de plus a l'ouverture. Le verrou est donc mis ici, une fois, dans la fonction que toutes
-- les regles d'acces appellent deja.

/*
 * Un compte est valide s'il est approuve, et — s'il a choisi un deuxieme facteur — si la session
 * courante l'a effectivement presente.
 *
 * La condition est ecrite dans ce sens precis : quelqu'un qui n'a pas de facteur verifie n'est
 * jamais gene, et quelqu'un qui en a un ne peut plus lire ses listes depuis une session qui s'est
 * arretee au mot de passe. C'est ce qui fait la difference entre une 2FA reelle et une 2FA
 * decorative, que n'importe quel appel direct a l'API contournerait.
 *
 * `auth.jwt()` est lu plutot que la table des sessions : le niveau atteint est dans le jeton, et
 * une session elevee entre-temps le porte des son rafraichissement.
 */
create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'approved'
  )
  and (
    coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified'
    )
  )
$$;

comment on function public.is_approved() is
  'Approuve, et au niveau d authentification que le compte s est lui-meme impose. Toutes les regles d acces passent par elle.';

/*
 * Les codes de secours.
 *
 * Perdre son telephone ne doit pas vouloir dire perdre ses listes. Ces codes sont la porte de
 * sortie : chacun ne sert qu'une fois, et l'utiliser desactive le deuxieme facteur au lieu de
 * remplacer sa saisie. C'est volontaire — un code note sur un papier qui vaudrait indefiniment
 * comme second facteur serait un second facteur en moins bien. Il ramene le compte a l'etat d'avant
 * la 2FA, a charge de la reactiver depuis un appareil qu'on a encore.
 *
 * Seul le condensat est garde. La table n'a aucune regle d'acces et personne n'a le droit de la
 * lire : on n'y touche que par les trois fonctions ci-dessous.
 */
create table public.mfa_backup_codes (
  user_id uuid not null references auth.users on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  primary key (user_id, code_hash)
);

alter table public.mfa_backup_codes enable row level security;
revoke all on table public.mfa_backup_codes from anon, authenticated;

create index mfa_backup_codes_unused_idx
  on public.mfa_backup_codes (user_id)
  where used_at is null;

/*
 * Combien de codes restent. Le nombre suffit a l'ecran de securite ; les codes eux-memes ne
 * ressortent jamais apres leur creation, c'est tout l'interet de ne stocker que des condensats.
 */
create or replace function public.backup_codes_left()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.mfa_backup_codes
  where user_id = (select auth.uid()) and used_at is null
$$;

/*
 * Fabrique dix codes neufs et rend les codes en clair, une seule fois.
 *
 * Les anciens disparaissent : en avoir deux series valides en meme temps voudrait dire qu'une
 * feuille imprimee il y a un an ouvre encore le compte, alors qu'on croit l'avoir remplacee.
 *
 * Le format est dix caracteres pris dans un alphabet sans les lettres qui se confondent a la
 * lecture : ni O ni I ni L ni U, qu on lirait 0, 1, 1 et V. Ces codes se recopient a la main,
 * souvent depuis un papier, souvent mal.
 */
create or replace function public.create_backup_codes()
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  code text;
  i integer;
  j integer;
begin
  if (select auth.uid()) is null then
    raise exception 'session requise' using errcode = '42501';
  end if;

  delete from public.mfa_backup_codes where user_id = (select auth.uid());

  for i in 1..10 loop
    code := '';

    for j in 1..10 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;

    insert into public.mfa_backup_codes (user_id, code_hash)
    values (
      (select auth.uid()),
      extensions.crypt(code, extensions.gen_salt('bf'))
    );

    return next code;
  end loop;
end;
$$;

/*
 * Consomme un code de secours et retire le deuxieme facteur.
 *
 * Appelable depuis une session restee en aal1 : c'est precisement la situation ou l'on s'en sert,
 * le telephone perdu et la session bloquee a la porte. Le code est marque utilise avant que le
 * facteur ne parte, pour qu'un appel interrompu ne laisse pas un code encore valide sur un compte
 * deja ouvert.
 *
 * La comparaison passe par `crypt`, donc a temps a peu pres constant pour un condensat donne ; la
 * limitation du nombre d'essais est celle de l'API, comme pour un mot de passe.
 */
create or replace function public.consume_backup_code(code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  trouve text;
begin
  if moi is null then
    raise exception 'session requise' using errcode = '42501';
  end if;

  select code_hash into trouve
  from public.mfa_backup_codes
  where user_id = moi
    and used_at is null
    and code_hash = extensions.crypt(upper(trim(code)), code_hash)
  limit 1;

  if trouve is null then
    return false;
  end if;

  update public.mfa_backup_codes
  set used_at = now()
  where user_id = moi and code_hash = trouve;

  delete from auth.mfa_factors where user_id = moi;

  return true;
end;
$$;

revoke all on function public.backup_codes_left() from public;
revoke all on function public.create_backup_codes() from public;
revoke all on function public.consume_backup_code(text) from public;

grant execute on function public.backup_codes_left() to authenticated;
grant execute on function public.create_backup_codes() to authenticated;
grant execute on function public.consume_backup_code(text) to authenticated;

/*
 * Les sessions ouvertes du compte, et de quoi en fermer une.
 *
 * « Se deconnecter partout » existe deja cote Supabase, mais c'est une massue : on veut pouvoir
 * fermer la tablette pretee sans se deconnecter soi-meme du telephone qu'on tient. La table
 * `auth.sessions` porte deja ce qu'il faut pour reconnaitre un appareil — la date, le navigateur,
 * l'adresse — et rien d'autre n'est expose.
 *
 * `is_approved()` n'est deliberement pas exige : consulter et fermer ses propres sessions doit
 * rester possible depuis une session en aal1, sinon quelqu'un qui a perdu son second facteur ne
 * peut meme plus faire le menage.
 */
create or replace function public.my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  refreshed_at timestamptz,
  user_agent text,
  ip text,
  aal text,
  current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.created_at,
    coalesce(s.refreshed_at at time zone 'utc', s.updated_at) as refreshed_at,
    s.user_agent,
    host(s.ip) as ip,
    s.aal::text,
    s.id = (select (auth.jwt() ->> 'session_id')::uuid) as current
  from auth.sessions s
  where s.user_id = (select auth.uid())
    and (s.not_after is null or s.not_after > now())
  order by coalesce(s.refreshed_at at time zone 'utc', s.updated_at) desc
$$;

/*
 * Ferme une session. La sienne comprise — c'est une deconnexion, et il n'y a pas de raison de
 * l'interdire depuis la liste ou on la voit.
 */
create or replace function public.revoke_session(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'session requise' using errcode = '42501';
  end if;

  delete from auth.sessions where id = target and user_id = (select auth.uid());
end;
$$;

revoke all on function public.my_sessions() from public;
revoke all on function public.revoke_session(uuid) from public;

grant execute on function public.my_sessions() to authenticated;
grant execute on function public.revoke_session(uuid) to authenticated;

comment on table public.mfa_backup_codes is
  'Condensats des codes de secours. Aucune regle d acces: la table ne se lit que par les fonctions security definer.';
comment on function public.consume_backup_code(text) is
  'Retire le deuxieme facteur contre un code a usage unique. Appelable en aal1, c est le but.';
comment on function public.my_sessions() is
  'Les sessions ouvertes du compte appelant, sans passer par la cle de service.';

/*
 * Les listes repassent par la porte commune.
 *
 * `can_access_list` avait perdu l appel a `is_approved()` en devenant une regle d appartenance a la
 * liste : depuis, un compte rejete gardait ses lignes dans `list_members` et continuait donc de
 * lire ses listes, alors que ses magasins et son foyer lui etaient bien fermes. Le remettre repare
 * cet ecart et, du meme coup, etend le verrou du deuxieme facteur aux listes, aux articles, aux
 * messages et aux sondages, qui passent tous par ici.
 *
 * L appartenance reste la regle : etre approuve ne suffit pas a ouvrir la liste de quelqu un
 * d autre.
 */
create or replace function public.can_access_list(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_approved() and exists (
    select 1
    from public.list_members lm
    where lm.list_id = target and lm.user_id = (select auth.uid())
  )
$$;

-- Retirer son propre vote etait la derniere ecriture qui ne demandait rien : ni compte approuve,
-- ni deuxieme facteur. Elle s aligne sur le reste.
drop policy poll_votes_delete on public.poll_votes;
create policy poll_votes_delete on public.poll_votes for delete
  using (public.is_approved() and user_id = (select auth.uid()));
