-- La main dominante suit la personne, comme les autres préférences d'apparence.
--
-- Le bouton de création est posé en bas à droite, la place que recommande Android parce que c'est
-- là qu'arrive le pouce d'un droitier. Pour un gaucher, c'est le coin le plus loin de la main :
-- il faut changer de prise pour ajouter un article, geste qu'on répète des dizaines de fois en
-- faisant ses courses, une main sur le chariot.
--
-- Droitier par défaut, puisque c'est le placement actuel : personne ne voit son écran bouger.
--
-- Ce côté est physique et non logique : il ne suit pas le sens de lecture, sans quoi le réglage
-- serait inversé en arabe. La colonne dit donc « main », pas « début » ou « fin ».

alter table public.profiles
  add column hand text not null default 'right'
    check (hand in ('right', 'left'));

-- Sans cette ligne, l'écriture partirait sans erreur visible et ne changerait rien : les droits
-- sur profiles sont accordés colonne par colonne depuis la migration d'approbation.
grant update (hand) on public.profiles to authenticated;
