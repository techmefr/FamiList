-- Le prix d'un produit, releve dans un magasin, a une date.
--
-- Rien ne gardait trace de ce qu'on paie. La valeur attendue est simple et tient en une phrase :
-- savoir que ce produit coute moins cher la-bas qu'ici. C'est une comparaison entre magasins, pas
-- une courbe : la table garde l'historique complet parce qu'un releve se perime, mais l'ecran ne
-- montre que le dernier prix connu de chaque magasin.
--
-- Il n'y a pas de catalogue de produits : les articles sont tapes a la main, liste apres liste. Ce
-- qui identifie « le meme produit » d'une semaine sur l'autre est donc le slug de son nom, celui
-- que public.slugify() produit deja pour la colonne generee items.product_slug et pour l'ordre
-- appris dans shop_item_orders. On ne pointe volontairement pas items.id : un article est
-- consommable, il disparait avec sa liste, alors que le prix doit survivre a la course.
--
-- Le nom est conserve a cote du slug parce qu'un slug ne s'affiche pas, et qu'il ne se remonte pas
-- vers le nom d'origine.
--
-- La monnaie est portee par chaque ligne et non par le foyer : l'application se lit en dix langues,
-- un prix note en voyage doit garder la sienne, et l'affichage passe par Intl.NumberFormat cote
-- client. numeric(12, 2) et non un entier de centimes : la colonne items.qty est deja numeric, et
-- deux representations du meme genre de nombre dans la meme base se confondent tot ou tard.
--
-- recorded_at est ecrit par le client et non par defaut a now() : l'application est hors ligne
-- d'abord, et un prix saisi dans un magasin sans reseau part parfois plusieurs heures plus tard.
-- L'heure du releve est celle du magasin, pas celle de la synchronisation.
create table public.item_prices (
  id uuid primary key default extensions.uuid_generate_v4(),
  household_id uuid not null references public.households on delete cascade,
  shop_id uuid not null references public.shops on delete cascade,
  product_slug text not null,
  product_name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  recorded_at timestamptz not null default now(),
  recorded_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

-- L'ecran d'historique part toujours du foyer, puis d'un produit : c'est l'ordre de l'index.
create index item_prices_lookup_idx
  on public.item_prices (household_id, product_slug, shop_id, recorded_at desc);

alter table public.item_prices enable row level security;

-- Comme toutes les tables du foyer. La double condition n'est pas redondante : le magasin porte
-- deja son foyer, et sans elle une ligne pourrait rattacher le prix a un magasin d'ailleurs.
create policy item_prices_all on public.item_prices for all
  using (public.is_household_member(household_id) and public.can_access_shop(shop_id))
  with check (public.is_household_member(household_id) and public.can_access_shop(shop_id));

-- Les droits par defaut du schema couvrent deja les tables creees ensuite ; on les redit ici pour
-- que la table se suffise a elle-meme si ces defauts changent un jour.
grant select, insert, update, delete on public.item_prices to authenticated;

-- Une personne releve un prix pendant que l'autre finit la liste : l'ecran d'historique doit le
-- voir sans attendre la prochaine ouverture, comme les articles.
alter publication supabase_realtime add table public.item_prices;
