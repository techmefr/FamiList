-- Un magasin, c'est une enseigne, un nom, une adresse et un point sur la carte.
--
-- Jusqu'ici la table ne portait qu'un nom, dans lequel tout etait melange : « Carrefour Meximieux »
-- disait l'enseigne et la commune sans qu'on puisse s'en servir separement. Or les trois servent a
-- des choses differentes. L'enseigne porte la carte de fidelite, valable dans n'importe quel
-- magasin de la chaine. L'adresse distingue deux magasins de la meme enseigne, et c'est d'elle
-- qu'on tire la commune du trigramme. Le nom reste ce qu'on lit sur la devanture.
--
-- Tout est facultatif, et c'est voulu : un salon de coiffure ou une boucherie de quartier n'a pas
-- d'enseigne, et un magasin dont on n'a jamais saisi l'adresse doit continuer de fonctionner.
-- Les colonnes texte ont donc une valeur par defaut vide plutot que d'etre nullables — c'est ce
-- que fait deja `short`, et cela evite d'avoir a traiter le null a chaque lecture.
--
-- La position, elle, est vraiment nullable : « pas encore enregistree » et « le point 0,0 au large
-- de l'Afrique » ne sont pas la meme chose. Elle est saisie sur place, par le bouton qui lit le
-- GPS de l'appareil — aucun service de geocodage n'est appele, l'adresse ne sort pas du telephone.
alter table public.shops
	add column if not exists brand text not null default '',
	add column if not exists address text not null default '',
	add column if not exists lat double precision,
	add column if not exists lng double precision;

-- Une carte peut appartenir a une enseigne plutot qu'a un magasin precis.
--
-- `shop_id` existait deja mais n'etait jamais renseigne depuis l'ecran : la carte etait rattachee
-- au magasin en comparant son nom, ce qui casse des qu'on renomme l'un des deux. Le rattachement
-- devient explicite, et une deuxieme facon d'attacher apparait : par enseigne. C'est le cas
-- courant — une carte Carrefour marche dans tous les Carrefour, pas seulement celui de Meximieux.
--
-- Les deux colonnes peuvent etre remplies : le magasin precise, l'enseigne generalise, et la
-- notification a l'arrivee se sert de la premiere qui correspond.
alter table public.loyalty_cards
	add column if not exists brand text not null default '';

-- Retrouver les magasins d'une enseigne, pour proposer la carte au bon endroit.
create index if not exists shops_household_brand_idx
	on public.shops (household_id, brand)
	where brand <> '';
