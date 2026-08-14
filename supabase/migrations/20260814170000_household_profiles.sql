-- Noms des membres du foyer.
--
-- La policy de lecture des profils est volontairement etroite : chacun ne lit que le sien. Mais un
-- foyer sans noms n'est pas utilisable, on ne sait plus qui a pris quoi. Plutot que d'elargir la
-- policy — ce qui exposerait aussi le theme et la taille de texte de chacun — on expose par une
-- fonction les seules colonnes utiles, et seulement pour les personnes du meme foyer.

create or replace function public.household_profiles()
returns table (id uuid, display_name text, initial text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.initial
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
