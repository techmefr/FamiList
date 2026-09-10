-- Prenom, nom, et nom affiche.
--
-- Le profil n'avait qu'un `display_name`, et les initiales de la pastille se devinaient en
-- decoupant cette chaine. Ca marche pour « Helene Moreau », pas pour « Mamie » : un surnom d'un
-- seul mot ne donne qu'une lettre alors que la personne a bien un prenom et un nom.
--
-- Les deux colonnes arrivent vides et le restent tant que personne ne les remplit : l'inscription
-- ne les demande pas, elle garde son champ unique. `display_name` reste donc la seule source sure
-- du nom affiche, et le seul champ obligatoire.

alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '';

-- Les droits sur profiles sont accordes colonne par colonne depuis la migration d'approbation :
-- sans cette ligne, l'ecriture partirait sans erreur visible et ne changerait rien.
grant update (first_name, last_name) on public.profiles to authenticated;

-- Le foyer lit les deux nouvelles colonnes au meme titre que le nom : c'est de la que se tirent
-- les initiales d'un membre, et elles doivent etre justes pour tout le monde, pas seulement pour
-- soi. La policy de lecture reste etroite — seules les colonnes utiles au foyer sortent d'ici.
drop function if exists public.household_profiles();

create function public.household_profiles()
returns table (
  id uuid,
  display_name text,
  first_name text,
  last_name text,
  initial text,
  avatar text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.first_name, p.last_name, p.initial, p.avatar
  from public.profiles p
  where public.is_approved()
    and exists (
      select 1
      from public.household_members mine
      join public.household_members theirs on theirs.household_id = mine.household_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = p.id
    )
$$;

revoke all on function public.household_profiles() from public;
grant execute on function public.household_profiles() to authenticated;
