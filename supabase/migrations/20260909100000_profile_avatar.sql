-- Le portrait des membres du foyer.
--
-- Une vignette carree de 128 px, rangee en `data:` dans la ligne du profil plutot que dans un
-- espace de fichiers. A cette taille elle pese une poignee de kilo-octets : elle voyage avec le
-- reste du foyer, sans deuxieme chemin de donnees a securiser, et elle reste lisible hors ligne.
-- La contrainte de longueur est la pour que ce choix reste tenable — au-dela, c'est qu'on essaie
-- d'y ranger la photo d'origine.

alter table public.profiles
  add column if not exists avatar text not null default '';

alter table public.profiles
  drop constraint if exists profiles_avatar_size;

alter table public.profiles
  add constraint profiles_avatar_size check (length(avatar) <= 200000);

grant update (avatar) on public.profiles to authenticated;

-- La fonction expose desormais le portrait, au meme titre que le nom et les initiales : la policy
-- de lecture des profils reste etroite, seules les colonnes utiles au foyer sortent d'ici.
drop function if exists public.household_profiles();

create function public.household_profiles()
returns table (id uuid, display_name text, initial text, avatar text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.initial, p.avatar
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
