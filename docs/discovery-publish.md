# Publishing recipes to Discover

Card 4 of 4 of the Discover feature: users can publish their own recipes to the shared library. See
[discovery-search.md](./discovery-search.md), [discovery-ingest.md](./discovery-ingest.md) and
[discovery-page.md](./discovery-page.md) for the rest.

## What publishing does

`POST /api/recipes/:recipeId/publish` (owner only) writes a **snapshot** into `discoveryRecipes` (`source: 'user'`) through
`DiscoveryService.save`, the same Mongo-then-index write path the ingest uses. The personal recipe is not made visible:
`GET /api/recipes`, its `users` list and sharing are untouched.

- The snapshot copies title, ingredients (fresh ids), steps, tags, times, servings, difficulty. It carries no `users`,
  no `ownerId` and not the personal recipe's id. A test asserts none of these, nor the author's name, appears anywhere
  in the stored or indexed document.
- `publishedBy` (the username) and the attribution naming the author are present **only if the user ticked "Show my
  username"**; otherwise the attribution is `"<title>" by a Tandra user, CC BY-SA 4.0`.
- The back-reference (personal recipe id, library id, owner) lives in its own collection, `discoveryPublications`, and is
  never returned by a public endpoint. The library id (`user-<uuid>`) is minted before the library write and stored, so a
  retry after a half-finished publish reuses it instead of creating a second recipe.
- Editing the personal recipe later changes nothing public. **Republishing** ("Update public copy") replaces the same
  library document.
- `sourceUrl` of a user recipe is `/discover/<libraryId>` (there is no external source), so a copy made from it carries
  that as its `link` and the "already in your recipes" check works the same as for Wikibooks recipes. The preview shows no
  "original recipe" link for user recipes.

## Unpublish, and deleting the private recipe

`DELETE /api/discover/published/:libraryId` (the publisher only; anyone else gets 404) removes the library document, its
index entry and the publication row, library first and row last so a failure part-way can simply be repeated. The private
recipe is untouched.

**Deleting the personal recipe does not remove the public copy** (tested). The user keeps control: the Discover preview
of their own recipe shows "Your public recipe" with Unpublish, which works without the private recipe existing.

## Risks the card required handling

- **Imported recipes: blocked.** A recipe with a `link` (imported from a URL) or an `attribution` (copied from Discover)
  holds someone else's text and cannot be published: the API answers 422 and the app explains instead of showing the
  button. The alternative, "confirm you authored it", is an honour system that a one-tap tick defeats; blocking is
  checked, not trusted. Limit: a user can delete the link from their own recipe and publish text they did not write.
  That cannot be detected; the licence step makes them state authorship and the report path is the backstop.
- **Licence consent.** The publish drawer states CC BY-SA 4.0 and requires an unticked-by-default "I wrote this recipe
  myself and agree to share it under CC BY-SA 4.0" before the button enables; the API refuses without
  `agreeToLicence: true` (400). The licence is stored on the document.
- **Moderation.** `POST /api/discover/recipes/:id/report` (any signed-in user, optional reason up to 500 characters; one
  report per person per recipe, a repeat replaces the reason) stores into `discoveryReports`. Admins read them with
  `GET /api/discover/reports` (grouped per recipe with counts and reasons, reporters not named) and remove a recipe with
  `DELETE /api/discover/recipes/:id`. **Who may call these:** the tandra (Better Auth) user ids in `DISCOVERY_ADMIN_USER_IDS`
  (comma-separated). Unset means nobody. Everyone else, including the recipe's own publisher, gets 403. Delisting removes
  the document from Mongo and the index and clears its publication and reports. It is refused for Wikibooks recipes (400):
  the next ingest would bring them straight back. There is no admin UI; the endpoints are for `curl`/a future screen.
- **Duplicates: refused.** A recipe whose title (case-insensitive) and set of ingredient names (lowercased, trimmed,
  de-duplicated) equal an existing library recipe is refused with 409. Different ingredients or a different title is fine,
  and a recipe is never a duplicate of its own earlier publication.

## Covers

The cover is **copied** to `discovery-image/<libraryId>/<timestamp>.<ext>`, a key that reveals neither the owner nor the
private recipe (the private keys contain both). Replacing or deleting the private cover, or the recipe, cannot break the
public one (tested). `GET /api/image/discovery-image/...` needs a signed-in user and is served only while a library recipe
still uses that key, so unpublishing or delisting takes the picture down with the recipe.

**Known limit:** unpublishing or delisting does not remove the bytes of a cover from the bucket (a few tens of KB each):
the shared `ObjectStoreConnection` in `@imapps/api-utils` has no delete. They are unreachable through the API. Deleting
an account does remove them (see [account-deletion.md](account-deletion.md)), through its own bucket client.

When a user adds a library recipe that has a cover, the cover is copied again to the user's own `recipe-upload/` key, never
referenced.

## Operations

Set `DISCOVERY_ADMIN_USER_IDS` on the API to enable moderation. Reports pile up silently otherwise: check
`GET /api/discover/reports` from time to time.
