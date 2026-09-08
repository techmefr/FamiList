-- Les préférences d'apparence suivent la personne, pas l'appareil.
--
-- Jusqu'ici `theme` et `type_scale` existaient en base mais n'étaient ni lus ni écrits : tout
-- vivait dans le localStorage. Quelqu'un qui avait réglé « Confort » sur son téléphone repartait
-- de zéro sur la tablette — exactement la personne pour qui ce réglage compte le plus.
--
-- `type_scale` n'acceptait que trois valeurs alors que l'application en propose sept. On remappe
-- l'existant sur les crans les plus proches avant d'élargir la contrainte.

alter table public.profiles drop constraint if exists profiles_type_scale_check;

update public.profiles set type_scale = case type_scale
  when 'compact' then 'xs'
  when 'normal' then 'sm'
  when 'large' then 'lg'
  else 'sm'
end;

alter table public.profiles alter column type_scale set default 'sm';

alter table public.profiles add constraint profiles_type_scale_check
  check (type_scale in ('xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'comfort'));

-- La valeur par défaut du thème passe à « system » : suivre l'appareil est le bon point de
-- départ, et c'est déjà ce que fait le client quand aucune préférence n'est enregistrée.
alter table public.profiles alter column theme set default 'system';

alter table public.profiles
  add column accent_id text not null default 'terracotta'
    check (accent_id in ('terracotta', 'forest', 'blue', 'plum', 'teal', 'ink')),
  add column font_id text not null default 'system'
    check (font_id in ('system', 'atkinson', 'grotesk')),
  add column motion text not null default 'system'
    check (motion in ('system', 'full', 'none')),
  add column sound boolean not null default true,
  add column haptics boolean not null default true,
  add column has_seen_tour boolean not null default false;

-- Sans cette ligne, les écritures partiraient sans erreur visible et ne changeraient rien : les
-- droits sur profiles sont accordés colonne par colonne depuis la migration d'approbation, pour
-- que personne ne puisse se promouvoir administrateur en modifiant son propre profil.
grant update (
  display_name,
  initial,
  tint,
  theme,
  type_scale,
  accent_id,
  font_id,
  motion,
  sound,
  haptics,
  has_seen_tour
) on public.profiles to authenticated;
