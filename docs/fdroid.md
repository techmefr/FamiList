# Publishing FamiList on F-Droid

## What the repository contains

- Two Gradle flavors: `play` (with ML Kit) and `fdroid` (without any Google component).
- `FAMILIST_FLAVOR=fdroid pnpm exec cap sync android` removes the ML Kit plugin from the generated Gradle files. The app then falls back to camera scanning + ZXing.
- The store listing metadata in `fastlane/metadata/android/{fr-FR,en-US}/`.
- The draft fdroiddata recipe in `metadata/fr.techmefr.familist.yml`.

## Local F-Droid build

```sh
pnpm install --frozen-lockfile
pnpm build
FAMILIST_FLAVOR=fdroid pnpm exec cap sync android
cd android && ./gradlew assembleFdroidRelease
```

Run `pnpm exec cap sync android` again without the variable to go back to the `play` flavor.

## Still to do

1. On every release, increment `versionCode` and `versionName` in `android/app/build.gradle`, then add `fastlane/metadata/android/*/changelogs/<versionCode>.txt`.
2. Create and push the tag: `git tag v0.1.0 && git push origin v0.1.0`.
4. Add screenshots in `fastlane/metadata/android/<language>/images/phoneScreenshots/` and an icon `images/icon.png` (512 px).
5. Fork https://gitlab.com/fdroid/fdroiddata and copy `metadata/fr.techmefr.familist.yml` into its `metadata/`. Then check with `fdroid readmeta`, `fdroid lint fr.techmefr.familist` and `fdroid build -v -l fr.techmefr.familist`.
6. Open the MR on fdroiddata with the "App inclusion" template, then answer the reviewers.
7. Optional: make builds reproducible with `Binaries:` and `AllowedAPKSigningKeys:` once the signed APK is published in the GitHub releases.
