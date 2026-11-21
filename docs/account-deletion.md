# Deleting an account

Settings → Account → **Delete my account** calls `DELETE /api/account` with `{ "username": "<typed>" }`. The server
refuses (403, nothing touched) unless the typed text equals the signed-in user's own username exactly, and answers 204
once everything below is gone. The web app then signs the device out and wipes its local data, like a normal logout.

Better Auth's own `/api/auth/delete-user` stays disabled: it has no typed confirmation, and one entry point is easier to
keep complete. `AccountService` (`packages/api/src/domain/AccountService`) owns the cascade and finishes with Better Auth's
internal adapter (`createCredentialsEraser`).

## What goes

| Data | Treatment |
| --- | --- |
| Lists, recipes, todos, meal plans, labels the user owns | deleted (a legacy list or recipe with no `ownerId` counts when the user is its only member) |
| Other people's lists, recipes, todos, meal plans the user was shared into | the user is removed from `users[]`; the content stays with its owner |
| Recipe photos: `recipe-upload/<userId>/…`, `recipe-image/<recipeId>` of owned recipes | removed from the bucket |
| Discover publications | **removed**, not anonymised: the library recipe, its search-index entry, its `discovery-image/<libraryId>/…` cover copies, the reports filed against it and the publication row |
| Reports the user filed | deleted |
| Friendships (both directions), pairing codes they created | deleted |
| Push subscriptions, list invites they issued (and their name as a claimer of others') | deleted |
| `user`, `account`, `session` and `verification` rows pointing at them | deleted last |
| Item aisle cache (`itemCategories`) | untouched: keyed by item name, holds nothing about a person |

Open list sockets of the user are closed. Copies other people already made of a published recipe stay theirs, as the
CC BY-SA licence allows.

## Order and retries

Sign-in rows go last. If a step fails the session is still valid, so the person can press the button again; every step
is safe to repeat, and two requests at once leave the same end state (the second finds nothing to do). Files are removed
before the rows that name them, so a retry can still find them. Once the session is gone a repeat gets 401.

### Concurrent requests

There is no global request lock: a fence over every request would add a write per request and could fail closed for
every user after a hard kill. Deletion relies on idempotent steps and per-document checks instead.

- Every step is safe to repeat, and two deletions at once leave the same end state.
- Recipe, todo and meal-plan replacements atomically compare the membership they read. A stale owner edit gets 409
  instead of restoring a removed member's id or username. Lists already use revision checks.
- Sharing (below) is resolved against the canonical `user` records, so a request that is still in flight cannot add a
  deleted account to someone's list.
- Background tag/category updates only update surviving documents; the item-category cache is global.
- Sessions die with the final credentials step, so once it has run nothing can write as the user.

Residual window: a request the user's device had already started when erasure began can still create a row owned by
the deleted id (for example an upload that finishes after the sweep). Nobody can sign in as that id any more, so the row
is unreachable, but it is not swept automatically.

### Sharing never trusts the client's member list

Every path that sets who something is shared with (create, replace, add one member) resolves the requested ids against
the owner's current friendships and the canonical `user` records, and stores the canonical username. A deleted or
unfriended id, or a stale cached member object from a queued/offline edit, is a 403 rather than being written back.

### Images removed before ownership is discarded

Unpublish and admin delist sweep the entire `discovery-image/<libraryId>/` prefix, including earlier republish covers,
before dropping the publication row. Recipe deletion removes its deterministic AI key even when generation failed
before recording that key on the recipe. Bucket failures retain ownership rows so physical cleanup can be retried.
Account deletion applies the same deterministic-key cleanup. Legacy AI keys still referenced by another person's
recipe stay with that copy and are removed when their final referencing recipe is deleted.


## Decision: no 30-day grace period

Deletion is immediate. A grace period needs a queued state, a scheduler, a Settings banner and a way to cancel, and
until it runs the account's data would stay readable by friends and on Discover, which is the opposite of what someone
who presses "delete" expects. The confirmation (typing the username, behind a dialog that says it cannot be undone) is
what guards against a mistake. Revisit if support sees accidental deletions.

## Privacy notice (tandra-site)

**Status:** the Erasure and retention rows were updated in the `tandra-site` repo, branch `privacy-account-deletion-analytics`, by the owner (answer to wait 201, 2026-11-20). They match this document: deletion is immediate from Settings -> Account, Discover publications are removed and not anonymised, owned lists, recipes and todos are deleted for everyone, and there is no grace-period retention. The draft wording below stays as the reference text.

`src/pages/privacy.astro` lives in the separate `tandra-site` repository, so it is updated there. The wording the Erasure
and retention rows need to match this behaviour:

- **Erasure:** You can delete your account yourself in Settings → Account → Delete my account. It takes effect at once:
  your lists, recipes, todos, meal plans, labels, friends, photos, notification subscriptions and sign-in details are
  deleted, and any recipe you published to Discover is taken down. Lists, recipes, todos and meal plans you own are deleted
  for everyone they were shared with; ones other people own stay with them, without you. Copies of a published recipe that
  other people already added to their own recipes stay theirs.
- **Retention:** Nothing is kept for a grace period after you delete your account. (Check the log retention period
  before publishing a statement about server logs: logs mention user ids and are not touched by the deletion.)
