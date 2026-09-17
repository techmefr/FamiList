# Héberger FamiList soi-même

Le README s'adresse à qui développe le projet. Cette page s'adresse à qui veut le faire tourner
pour sa famille, et n'ouvrira pas un terminal deux fois par semaine.

Il n'y a **pas deux services jumeaux** à lancer. Il y a une base de données Supabase, qui tourne en
conteneurs Docker, et une application web qui n'est qu'un dossier de fichiers statiques — elle
n'exécute rien côté serveur.

## Ce qu'il faut

| | |
| --- | --- |
| **Docker** | fait tourner la base, l'authentification et le stockage |
| **Node 24 ou plus** | construit l'application |
| **pnpm** | installé par `corepack enable pnpm` |
| un hébergeur de fichiers | Vercel, Netlify, un nginx — n'importe lequel |

La CLI Supabase n'est pas à installer séparément : elle est épinglée dans les dépendances du
projet.

## Un compte Supabase, ou chez soi

Deux chemins, et le second n'est pas plus « pur » que le premier.

**Supabase hébergé** : on crée un projet sur supabase.com, on relie le dépôt, on pousse le schéma.
Rien à administrer, une base sauvegardée. C'est ce que fait l'instance d'origine.

**Tout chez soi** : Supabase se lance en Docker sur sa propre machine. Il faut alors gérer les
sauvegardes, les certificats et les mises à jour — ce qui est un vrai travail, pas une case à
cocher.

La suite décrit le premier chemin, avec les écarts du second signalés au passage.

## Mettre en place la base

```sh
git clone https://github.com/techmefr/Familiste.git
cd Familiste
pnpm install
```

Relier le projet Supabase, puis appliquer le schéma :

```sh
pnpm exec supabase link --project-ref <la-reference-du-projet>
pnpm exec supabase db push
```

> **Ne jamais jouer `supabase/seed.sql` en production.** Il crée un compte de test dont le mot de
> passe est écrit dans le dépôt, confirmé et approuvé d'office. Il n'existe que pour les tests
> automatisés.

Certaines fonctions tournent côté serveur — courriels, publication de signalements, import de
recette. Elles se déploient une fois :

```sh
pnpm exec supabase functions deploy notify-admins
pnpm exec supabase functions deploy publish-report-issues
pnpm exec supabase functions deploy import-recipe
pnpm exec supabase functions deploy test-instance-mail
```

Pour un hébergement à domicile, remplacer les deux premières commandes par `pnpm exec supabase
start`, et lire l'URL et la clé qu'il affiche.

## Construire et publier l'application

Deux variables, les seules du projet :

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
```

Elles sont publiques par construction : elles partent dans le fichier que télécharge le navigateur.
La sécurité tient aux règles de la base, pas à leur secret. La clé `service_role`, elle, n'a rien à
faire ici.

```sh
pnpm build
```

Le résultat est dans `build/`. Toute route inconnue doit être renvoyée vers `index.html`, sinon un
lien partagé vers une liste tombera sur une page absente. Sur Vercel, `vercel.json` s'en charge
déjà ; ailleurs, c'est une ligne de configuration à écrire.

Régler enfin, dans les réglages d'authentification du projet Supabase, l'adresse du site et les
URL de redirection sur le domaine réel. Sans cela, le lien reçu par courriel ramène ailleurs.

## Le premier compte

**Le premier compte créé devient administrateur, et il est approuvé sur-le-champ.** Tous les
suivants arrivent en attente et ne voient rien tant qu'ils ne sont pas validés.

Donc : créer son propre compte **immédiatement** après la mise en ligne. Quelqu'un d'autre qui
s'inscrirait avant deviendrait l'administrateur de votre instance.

Les inscriptions suivantes se valident depuis `/admin`. Un administrateur ne peut pas valider son
propre compte — c'est voulu.

## Le reste se règle dans l'application

Depuis `/admin`, sans terminal :

- **L'envoi de courriels** — serveur, port, identifiant, mot de passe, expéditeur. Le mot de passe
  part dans le coffre de la base et ne se relit jamais, pas même par un administrateur.
- **Le jeton GitHub**, si l'on veut qu'un signalement ouvre une issue.

Un bouton d'essai envoie un message et dit ce qui a échoué.

> L'erreur la plus fréquente est l'**expéditeur non vérifié**. Brevo, Sendgrid et les autres
> refusent d'envoyer depuis une adresse qu'on ne leur a pas prouvée. Vérifier l'adresse chez le
> fournisseur avant de la poser ici.

Tant que rien n'est configuré, les courriels s'accumulent sans partir. L'écran le dit. Les
inscriptions restent visibles dans `/admin`, qui fait foi.

## Mettre à jour

```sh
git pull
pnpm install
pnpm exec supabase db push
pnpm build
```

Redéployer le contenu de `build/`, et redéployer les fonctions si elles ont changé. Les migrations
ne s'appliquent qu'une fois : rejouer `db push` sur une base à jour ne fait rien.

## Quand ça ne marche pas

**L'installation échoue sur la version de Node.** Une dépendance exige Node 24, et `.npmrc` refuse
de passer outre. `node --version` doit afficher 24 ou plus.

**Personne ne reçoit de courriel.** Vérifier l'expéditeur chez le fournisseur, puis le bouton
d'essai dans `/admin`.

**Quelqu'un s'est inscrit et ne voit rien.** C'est le comportement prévu : son compte attend une
validation dans `/admin`.

**Une page rechargée renvoie une erreur 404.** L'hébergeur ne réécrit pas vers `index.html`.
