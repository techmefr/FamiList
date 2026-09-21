# Changelog

## 0.1.0

The first release with recipes, meal planning, and optional AI assistance — built on top of the
existing shared-list core.

### Added

- Recipes: written by hand, imported from a link (schema.org structured data, with the page's own
  photo pulled in automatically), or asked for in plain words to a configured AI provider. Each
  recipe scales to a chosen number of servings and turns into a shopping list.
- A multi-turn AI conversation for refining a requested recipe ("what if I swap the chicken for
  tofu?"), kept local to the browser tab, never synced or stored server-side.
- Weekly meal plans: pick several recipes, generate one consolidated shopping list instead of one
  per recipe.
- Household dietary restrictions and allergies, including for people without an account of their
  own (children, guests) — taken into account by every AI recipe suggestion.
- Multiple saved AI provider keys per account, switchable from Profil → IA, instead of one at a
  time.
- Dish photo generation via a free, keyless provider — no AI key required for this specific
  feature.
- Editing for recipes and loyalty cards (previously create-and-delete only).
- A dedicated navigation destination for household management and meal plans on tablet and
  desktop.
- A "what's new" modal shown after an update, translated into the person's own language, offering
  to replay the guided tour.
- A premium visual pass across sign-in, sign-up, password reset, the first-launch walkthrough, and
  the lists screen.

### Fixed

- A local-cache upgrade crash (`DatabaseClosedError`) that permanently blocked the app for any
  device whose IndexedDB cache predated a Dexie schema change.
- A password-recovery link could sign a person fully into the app without ever asking for a new
  password, if the link's redirect landed anywhere other than the reset screen.
- An admin write endpoint (bug-report → GitHub issue) that skipped the second-factor requirement
  every other admin write already enforced.
- A race where adding a loyalty card right after another could make the first one vanish from
  screen, caused by a background sync cycle overwriting in-flight local writes.
- Recipe import failing on every link: the Supabase Edge Functions had never actually been deployed
  to the production project.
- Out-of-range serving/people counts silently failing to sync instead of being clamped.
