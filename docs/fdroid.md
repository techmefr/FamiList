# Publier FamiList sur F-Droid

## Ce que contient le dépôt

- Deux flavors Gradle : `play` (avec ML Kit) et `fdroid` (sans aucun composant Google).
- `FAMILIST_FLAVOR=fdroid pnpm exec cap sync android` retire le plugin ML Kit des fichiers Gradle générés. L'app retombe alors sur le scan caméra + ZXing.
- Les métadonnées de fiche dans `fastlane/metadata/android/{fr-FR,en-US}/`.
- Le brouillon de recette fdroiddata dans `metadata/fr.techmefr.familist.yml`.

## Build F-Droid en local

```sh
pnpm install --frozen-lockfile
pnpm build
FAMILIST_FLAVOR=fdroid pnpm exec cap sync android
cd android && ./gradlew assembleFdroidRelease
```

Relancer `pnpm exec cap sync android` sans la variable pour revenir au flavor `play`.

## Reste à faire

1. À chaque release, incrémenter `versionCode` et `versionName` dans `android/app/build.gradle`, puis ajouter `fastlane/metadata/android/*/changelogs/<versionCode>.txt`.
2. Créer et pousser le tag : `git tag v0.1.0 && git push origin v0.1.0`.
3. Dans la recette, remplacer `REPLACE_WITH_SHA256` par la somme officielle de l'archive Node (`SHASUMS256.txt` sur nodejs.org).
4. Ajouter des captures dans `fastlane/metadata/android/<langue>/images/phoneScreenshots/` et une icône `images/icon.png` (512 px).
5. Forker https://gitlab.com/fdroid/fdroiddata et copier `metadata/fr.techmefr.familist.yml` dans son `metadata/`. Vérifier ensuite avec `fdroid readmeta`, `fdroid lint fr.techmefr.familist` et `fdroid build -v -l fr.techmefr.familist`.
6. Ouvrir la MR sur fdroiddata avec le modèle « App inclusion », puis répondre aux relecteurs.
7. Facultatif : rendre les builds reproductibles avec `Binaries:` et `AllowedAPKSigningKeys:` une fois l'APK signé publié dans les releases GitHub.
