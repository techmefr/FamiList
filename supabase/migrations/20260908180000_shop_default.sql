-- Le magasin que le foyer n'a pas cree lui-meme.
--
-- Un parcours appartient toujours a un magasin : `shop_layouts` a pour cle primaire
-- (shop_id, user_id) et une cle etrangere vers `shops`. Un foyer sans magasin n'avait donc nulle
-- part ou ecrire l'ordre de ses rayons, et les fleches comme le glisser-deposer ne faisaient rien
-- du tout, sans le moindre message. Chaque foyer recoit desormais un magasin vide a sa premiere
-- ouverture, ce qui donne au rangement un endroit ou vivre des le depart.
--
-- Le premier vrai magasin le remplace plutot que de s'ajouter a cote : le rangement deja fait
-- change de nom, il n'est pas perdu. Ce drapeau dit lequel est remplacable.
alter table public.shops
	add column if not exists is_default boolean not null default false;

-- Un seul magasin par defaut par foyer. La contrainte est ici et pas seulement dans le code :
-- deux appareils qui ouvrent l'application en meme temps sur un foyer neuf tenteraient tous les
-- deux de le creer. L'identifiant est deja derive du foyer pour que les deux ecritures visent la
-- meme ligne ; cet index est la ceinture, au cas ou.
create unique index if not exists shops_one_default_per_household
	on public.shops (household_id)
	where is_default;
