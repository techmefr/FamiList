# Changelog

All notable changes to this project are documented here.

## 0.1.0

### Added

- Weekly meal plans with a consolidated shopping list.
- Household member records, with dietary restrictions.
- AI recipe requests, including multi-turn conversation and a paste-text fallback when import is unreachable.
- Support for multiple saved AI provider keys per account.
- A dedicated household destination on tablet and desktop, and a meal plan entry in the navigation.
- A "what's new" modal shown after an update, offering to replay the guided tour.

### Fixed

- An optimistic loyalty card write no longer gets overwritten by a concurrent `hydrate()`.
- Recipe servings and meal-plan people counts are clamped to the database's supported range.
- A password-recovery session now stays confined to the reset screen.
- Bug-report GitHub issue requests now require a second authentication factor.
