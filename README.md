# FamiList

Liste de courses partagée pour un foyer : listes collaboratives, rayons ordonnés magasin par
magasin, cartes de fidélité, loupe d'accessibilité, et une discussion par liste avec sondages de
date et répartition de ce que chacun apporte.

Application SvelteKit servie en statique, données dans Supabase, cache local IndexedDB pour
fonctionner sans réseau. Le même build alimente le web et l'application Android via Capacitor.

## Prérequis

| Outil | Version | Pourquoi |
| --- | --- | --- |
| Node | **24 ou plus** | `@zxing/library` déclare `engines.node >= 24`, et `.npmrc` porte `engine-strict=true` : l'installation échoue sur Node 22 |
| pnpm | **11.9** | épinglé par `packageManager` dans `package.json` |
| Docker | — | requis par la pile Supabase locale |
| JDK + SDK Android | API 36 | seulement pour construire l'APK (Gradle 8.14.3, `compileSdk` 36, `minSdk` 24) |

La CLI Supabase n'est pas à installer : elle est épinglée dans les dépendances de développement et
s'appelle via les scripts `db:*`.

```sh
nvm use 24
```

## Installation

```sh
pnpm install
cp .env.example .env
```

Deux variables, les seules du projet :

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

Toutes deux sont publiques par construction : elles partent dans le bundle client, et la sécurité
repose sur les politiques RLS, pas sur leur confidentialité. La clé `service_role` n'a rien à faire
ici.

## Développement

```sh
pnpm db:start           # API 54321, base 54322, Studio 54323, courriels 54324
pnpm db:reset           # applique les migrations puis supabase/seed.sql
pnpm dev                # http://localhost:5173
```

`pnpm db:start` affiche l'URL d'API et la clé anon à recopier dans `.env`.

`pnpm db:reset` crée un compte de test confirmé et approuvé, celui dont se servent les tests de
bout en bout. Il n'existe que dans la pile locale.

Après toute migration qui change le schéma :

```sh
pnpm db:types           # régénère src/lib/db/types.ts
```

## Tests

```sh
pnpm check              # types
pnpm test               # unitaires
pnpm test:coverage      # unitaires, avec seuil de couverture
pnpm e2e                # bout en bout
```

Les tests de bout en bout ont besoin de la pile locale démarrée, et du navigateur Playwright :

```sh
pnpm exec playwright install --with-deps chromium
```

> Si `pnpm check` signale des erreurs dans des fichiers que vous n'avez pas touchés, cherchez un
> `node_modules` égaré dans un dossier parent : TypeScript remonte l'arborescence pour trouver
> `@types/node`, et en adopte alors une version étrangère au projet.

## Déploiement web

Le build est statique — `@sveltejs/adapter-static`, repli `index.html` — donc n'importe quel
hébergeur de fichiers convient, à condition de réécrire toutes les routes vers `index.html`.

```sh
pnpm build              # produit build/
pnpm preview            # sert ce build localement
```

Sur Vercel, `vercel.json` porte déjà la commande de build, le dossier de sortie, la réécriture et
les en-têtes de sécurité. Le seul réglage à faire dans l'interface est d'ajouter
`PUBLIC_SUPABASE_URL` et `PUBLIC_SUPABASE_ANON_KEY` aux variables d'environnement du projet.

### Base de production

```sh
pnpm exec supabase link --project-ref <ref>
pnpm exec supabase db push
```

`db push` applique les migrations. **Ne pas jouer `supabase/seed.sql` en production** : il crée un
compte de test dont le mot de passe est écrit dans le dépôt.

Régler enfin `site_url` et les URL de redirection sur le domaine réel, dans les réglages
d'authentification du projet Supabase.

#### Écrire une migration

Un fichier par changement, jamais de modification d'un fichier déjà appliqué :

```
supabase/migrations/<horodatage>_<nom_en_minuscules>.sql
```

L'horodatage doit être strictement postérieur à tous les autres, et **unique** : la CLI indexe ses
migrations sur ce seul nombre, pas sur le nom du fichier. Deux fichiers au même horodatage font
échouer `db:start` sur une violation de clé primaire.

Le client ne peut écrire que les colonnes listées dans un `grant update (...)`. Une colonne ajoutée
sans l'y inscrire se laisse lire, et refuse silencieusement les écritures.

## Premier compte

**Le premier compte créé devient administrateur, approuvé d'office.** Les suivants arrivent en
attente et ne voient aucune donnée tant qu'ils ne sont pas validés : les fonctions d'accès exigent
toutes `is_approved()`.

Créer donc son compte d'administration juste après la mise en ligne, puis valider les inscriptions
depuis `/admin`. Un administrateur ne peut pas valider son propre compte.

## Application Android

Capacitor embarque le build web (`webDir: 'build'`) : il n'y a pas de code mobile séparé.

```sh
pnpm build
pnpm exec cap sync android
cd android && ./gradlew assembleDebug
```

L'APK atterrit dans `android/app/build/outputs/apk/debug/`.

Le dossier `android/` est versionné : il porte la permission caméra et la configuration native
qu'un `cap add` sur une machine neuve ne saurait pas retrouver. Le projet iOS n'est pas généré, il
demande un Mac (`pnpm exec cap add ios`).

## Structure

```
src/lib/domain      logique pure, couverte par les tests unitaires
src/lib/components  composants d'interface
src/lib/db          schéma IndexedDB et types Supabase générés
src/lib/sync        synchronisation et file d'attente hors-ligne
src/lib/scan        décodage des codes-barres et QR
src/lib/i18n        traductions, dix langues
src/routes          pages
supabase/migrations schéma et politiques RLS
e2e                 tests de bout en bout
```
