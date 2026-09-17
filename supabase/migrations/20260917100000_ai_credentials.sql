-- La cle d'API d'intelligence artificielle que chacun apporte, et personne d'autre.
--
-- Cette table est l'exception du schema, et c'est tout son interet. Partout ailleurs ici,
-- appartenir au foyer c'est lire et ecrire : listes, articles, recettes, magasins, cartes de
-- fidelite, tout est partage par `is_household_member`. Le reflexe, en ajoutant une table, est
-- donc de la rattacher a un foyer. Ce serait faux ici. Une cle d'API est un moyen de paiement :
-- elle engage le quota et la facture d'une seule personne. La partager avec le foyer, ce serait
-- laisser un adolescent vider le credit de sa mere sans qu'elle le sache.
--
-- Trois failles ont deja porte sur ce perimetre (#15, #16, #17). Les deux erreurs a ne pas
-- commettre sont nommees ici pour qu'une relecture puisse verifier qu'elles sont absentes :
--
--   1. Aucune clause `is_household_member`. Le foyer n'a rien a voir avec cette table, et elle ne
--      porte volontairement pas de colonne `household_id` — une colonne qui n'existe pas ne peut
--      pas etre jointe par erreur dans une policy ecrite six mois plus tard.
--   2. Aucune clause `is_admin`. C'est le point le plus contre-intuitif : `profiles_select`
--      autorise l'administrateur a lire tous les profils, et recopier ce motif ici donnerait au
--      proprietaire de l'instance la cle de paiement de ses proches. Un administrateur administre
--      des comptes, il n'herite pas de leurs moyens de paiement. C'est aussi pour cela que la cle
--      ne vit pas dans une colonne de `profiles` : elle y serait lisible par cette policy-la.
--
-- Une ligne par compte, d'ou `user_id` en cle primaire plutot qu'un `id` separe : personne n'a
-- besoin de deux fournisseurs a la fois, et la cle primaire rend le doublon impossible sans
-- contrainte supplementaire.
create table public.ai_credentials (
  user_id uuid primary key references auth.users on delete cascade,
  -- La liste est fermee cote base parce qu'elle determine l'adresse appelee par le navigateur.
  -- Elle ne contient que des fournisseurs dont on a verifie qu'ils repondent a une requete
  -- d'origine navigateur, en-tetes CORS compris sur la reponse elle-meme et pas seulement sur le
  -- prevol. OpenAI en est absent pour cette raison precise : son prevol passe, mais ses reponses
  -- ne portent pas `access-control-allow-origin`, donc le navigateur refuse de les lire.
  provider text not null check (
    provider in ('anthropic', 'gemini', 'mistral', 'groq', 'openrouter', 'deepseek')
  ),
  api_key text not null check (length(api_key) between 1 and 512),
  -- Le modele est libre : les noms changent plus vite que les migrations, et une contrainte ici
  -- rendrait l'application inutilisable le jour ou un fournisseur renomme sa gamme. Vide = celui
  -- que le client propose par defaut pour ce fournisseur.
  model text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_credentials enable row level security;

-- Une seule policy, pour toutes les commandes, avec la meme condition des deux cotes. `for all`
-- plutot que quatre policies separees : quatre endroits ou ecrire la meme condition, c'est quatre
-- occasions d'en oublier une, et c'est exactement ainsi que naissent les trous de ce genre.
--
-- `(select auth.uid())` et non `auth.uid()` : c'est la forme retenue partout dans ce schema, elle
-- laisse le planificateur evaluer l'appel une fois pour la requete au lieu d'une fois par ligne.
create policy ai_credentials_own on public.ai_credentials for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.ai_credentials to authenticated;

-- Aucune publication temps reel sur cette table, et c'est volontaire. Les tables du foyer y sont
-- toutes ajoutees pour que deux telephones restent d'accord ; ici il n'y a rien a accorder — une
-- cle ne concerne qu'un compte — et la diffuser sur un canal websocket ferait voyager le secret
-- une fois de plus sans que cela serve a quoi que ce soit.

-- Savoir qui a une cle sans jamais lire laquelle.
--
-- L'ecran des recettes doit pouvoir demander « est-ce que je propose la suggestion » sans que la
-- reponse fasse transiter le secret. La question ne porte que sur le compte appelant, donc cette
-- fonction ne divulgue rien de plus que ce que la policy autorise deja ; elle evite simplement de
-- descendre la cle dans la page pour repondre a un booleen.
create or replace function public.has_ai_credential()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ai_credentials c where c.user_id = (select auth.uid())
  )
$$;

revoke all on function public.has_ai_credential() from public;
grant execute on function public.has_ai_credential() to authenticated;
