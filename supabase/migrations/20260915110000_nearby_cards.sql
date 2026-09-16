-- Proposer la carte de fidélité à l'approche d'un magasin, ou pas du tout.
--
-- Le réglage suit la personne et non l'appareil, comme le reste des préférences : quelqu'un qui a
-- refusé qu'on suive sa position sur son téléphone n'a pas à le refuser une deuxième fois sur la
-- tablette. Il part à faux, contrairement au son et aux vibrations — laisser un appareil suivre
-- sa position est un accord qui se donne, pas un défaut qu'on découvre après coup.
--
-- L'autorisation système reste maîtresse : ce booléen n'ouvre rien tout seul, il dit seulement que
-- la surveillance a le droit de démarrer quand l'appareil, lui, l'autorise.
alter table public.profiles
  add column nearby_cards boolean not null default false;

-- Les droits sur profiles sont accordés colonne par colonne depuis la migration d'approbation :
-- sans cette ligne l'écriture partirait sans erreur visible et ne changerait rien.
grant update (nearby_cards) on public.profiles to authenticated;
