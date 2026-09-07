-- Nommer correctement un compte arrive par un fournisseur externe.
--
-- Le formulaire de l application pose display_name dans les metadonnees, mais Google, Microsoft et
-- Apple n en savent rien : ils renvoient full_name ou name. Sans ces deux clefs, une inscription
-- Google s appelait par le debut de son adresse, ce qui donne des membres nommes « prenom.nom42 »
-- dans un foyer ou tout le monde se connait.
--
-- Apple peut aussi ne renvoyer aucune adresse quand la personne masque la sienne et qu on ne
-- demande pas le relais prive. split_part sur null rend null, et display_name est non nul : le
-- compte etait alors refuse a la creation. D ou le dernier repli en dur.
--
-- nullif partout : une metadonnee presente mais vide est plus courante qu absente, et coalesce
-- seul l aurait acceptee comme un nom.
--
-- Le reste ne bouge pas : le premier compte est toujours administrateur et deja valide.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_account boolean;
  name text;
begin
  perform pg_advisory_xact_lock(hashtext('familist:first_account'));
  select not exists (select 1 from public.profiles) into first_account;

  name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Membre'
  );

  insert into public.profiles (id, display_name, initial, role, status, reviewed_at)
  values (
    new.id,
    name,
    upper(left(name, 1)),
    case when first_account then 'admin' else 'user' end,
    case when first_account then 'approved' else 'pending' end,
    case when first_account then now() end
  );

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Cree le profil d un nouveau compte, quel que soit le fournisseur. Le tout premier est administrateur et valide, pour qu une base neuve ne soit pas un cul-de-sac.';
