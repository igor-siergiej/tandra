# E2E coverage matrix

Which feature is covered by which Playwright spec (`e2e/tests`). Update this file whenever a feature or spec is added.
"Visual" means a screenshot baseline in a `*.visual.spec.ts` file (mobile and desktop projects).
Mocks for AI, speech and push live in `e2e/mocks` (see `e2e/README.md`).

## Accounts and session

| Feature | Functional | Visual |
| --- | --- | --- |
| Login, register, validation, logout, register → sign out → sign in (`@smoke`) | `auth.spec.ts`, `login.spec.ts` | `auth.visual.spec.ts` |
| Wrong password, unknown user, taken username, password rules | `account-resilience.spec.ts` | |
| Reload keeps session, signed-out deep link returns to the page after login, expired session, switching users | `account-resilience.spec.ts` | |
| Menu: settings, theme, install prompt, update check | `account-resilience.spec.ts` | |
| Push notifications toggle | `account-resilience.spec.ts`, `mock-harness.spec.ts` | |
| Settings: unit system | `preferred-units.spec.ts` | `more-screens.visual.spec.ts` |
| Settings: voice keep-listening | `voice-keep-listening.spec.ts` | |
| What's new panel | `whats-new.spec.ts` | not captured (content changes every release) |
| Analytics: real Umami tracker loads from the runtime config, sends the page view and `item_added` | `analytics.spec.ts` | |

## Lists and items

| Feature | Functional | Visual |
| --- | --- | --- |
| Lists: add, rename, delete, open | `lists.spec.ts` | `lists.visual.spec.ts` |
| List title validation, duplicate name message | `lists-validation.spec.ts` | |
| Items: add, edit, select, clear, swipe delete | `items.spec.ts`, `swipe-actions*.spec.ts` | `items.visual.spec.ts` |
| Items: validation, aisles, images, server errors | `items-edge-cases.spec.ts` | |
| Add by voice (happy path, mic errors, confirm, keep-listening, parse failures, one-time notice) | `voice-add.spec.ts`, `voice-add-edge-cases.spec.ts`, `voice-notice.spec.ts` | |
| Offline queue for items | `offline-sync.spec.ts` | |
| Real-time shared lists | `realtime-sync.spec.ts` | |
| Drawers: add list, add item, edit item, voice, manage users, add from recipe | covered functionally above | `more-screens.visual.spec.ts` |

## Recipes and Discover

| Feature | Functional | Visual |
| --- | --- | --- |
| Recipes list, search | `recipes.spec.ts`, `recipes-library.spec.ts` | `recipes.visual.spec.ts` |
| Create manually, import from link | `recipe-create.spec.ts`, `recipe-import-title-focus.spec.ts` | `recipe-form.visual.spec.ts` |
| Recipe detail: edit, ingredients, steps, tags, cover | `recipe-detail.spec.ts`, `recipe-detail-edit.spec.ts` | `recipe-detail.visual.spec.ts` |
| Prep/cook time, servings, difficulty | `recipe-difficulty-time.spec.ts` | |
| Substitutes | `ingredient-substitutes.spec.ts` | |
| Add recipe ingredients to a list, portions, merging | `bulk-add.spec.ts`, `add-from-recipe.spec.ts`, `recipes-library.spec.ts` | |
| Waste Warrior | `waste-warrior.spec.ts`, `recipes-library.spec.ts` | `more-screens.visual.spec.ts` |
| Share target | `share-target.spec.ts` | |
| Discover: search, filters, preview, add, paging, report | `discover.spec.ts`, `discover-more.spec.ts` | `discover.visual.spec.ts` |
| Publish to Discover | `discover-publish.spec.ts` | |

## Planning

| Feature | Functional | Visual |
| --- | --- | --- |
| Calendar: todos, inbox, recurrence, labels, sharing | `calendar.spec.ts`, `calendar-more.spec.ts`, `labels.spec.ts` | `calendar.visual.spec.ts` |
| Calendar: edit a todo, time ordering, overdue marking | `todo-edit.spec.ts` | `dark.visual.spec.ts` |
| Meal plan: weeks, portions, shopping preview | `meal-plan.spec.ts`, `meal-plan-more.spec.ts` | `more-screens.visual.spec.ts` |
| Drawers: add todo, manage labels, shopping preview | covered functionally above | `more-screens.visual.spec.ts` |

## Friends and sharing

| Feature | Functional | Visual |
| --- | --- | --- |
| Friends: invite, redeem, remove | `friends.spec.ts`, `friends-two-user.spec.ts` | `friends.visual.spec.ts`, `more-screens.visual.spec.ts` (detail) |
| List sharing: members, non-owner view | `sharing.spec.ts`, `friends-two-user.spec.ts` | |

## Resilience

| Feature | Functional | Visual |
| --- | --- | --- |
| Offline and back-online banners, offline list and recipe edits | `account-resilience.spec.ts`, `offline-sync.spec.ts` | |
| Rejected queued change is dropped | `account-resilience.spec.ts` | |
| Unknown address page | `account-resilience.spec.ts` | `more-screens.visual.spec.ts` |
| Smoke against a deployed build | `smoke.spec.ts` | |

## Dark theme

`dark.visual.spec.ts` captures login, lists, items, calendar and recipes with the theme forced to dark through `localStorage`.

## Known gaps

- Render `ErrorBoundary` and the service-worker "update available" toast: service workers are blocked in e2e and there is no safe way to force a render error.
