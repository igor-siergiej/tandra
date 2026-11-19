# Heatmap preview

Umami draws a heatmap over a live iframe of `https://app.tandra.uk/<path>` inside the
dashboard at `https://analytics.imapps.uk`. That is a cross-site frame, so the Better Auth
session cookie (`SameSite=Lax`) is not sent and the frame loads signed out. Without special
handling every signed-in page would redirect to `/login` and the clicks would sit on the
wrong page.

## How the app handles it

- `packages/web/src/heatmapPreview/isHeatmapPreview.ts` is true only when the app runs in a
  **cross-origin** frame. `nginx.conf` allows exactly one such parent
  (`frame-ancestors 'self' https://analytics.imapps.uk`). Unframed, or framed by the app
  itself, nothing changes: signed-out visitors still go to `/login` or run as guests.
- When true, `installPreviewApi` answers the app's own `GET /api/*` from placeholder data
  (`fixtures.ts`), reports a signed-in session, and answers every write, socket or AI call
  with 404. The real api is never reached and no session is created.
- Every piece of user content in the fixtures is a run of block glyphs: the page keeps its
  real layout (row heights, wrapping, counts) and no real account data is shown.
- The preview frame loads no tracker or recorder, so viewing a heatmap records no traffic.

## Which routes produce a valid heatmap

Valid means the frame shows the same page layout the visitor was on.

| Recorded path | Heatmap shows |
| --- | --- |
| `/discover`, `/discover/:recipeId` | Discover browse grid / recipe preview with placeholder recipes |
| `/recipes`, `/recipes/:recipeId` | Recipe list / recipe page with a placeholder recipe |
| `/recipes/new`, `/recipes/use-up` | The page's form / search layout |
| `/calendar`, `/meal-plan` | Month grid and meal plan with blocked-out entries |
| `/friends` | Friends list with placeholder friends |
| `/` , `/list/:list` | Lists overview / a placeholder list. Recorded list paths are all redacted to `/list/:list`, so there is one heatmap for the list page |
| `/settings` | Settings page |
| `/login`, `/register`, `/signup-cta`, `/choose-username` | The real page; it needs no data |

Limits:

- The heatmap shows placeholder content in the places where a visitor saw their own data, so
  clicks line up with layout, not with the specific text. Item counts are the fixtures', so
  scroll depth on a long list can differ from what the visitor saw.
- Anything a page only fetches after a write, or from an endpoint not listed in
  `installPreviewApi.ts`, renders as that page's empty or error state. Add the route and a
  fixture there when a page needs more data.

## Operator notes

- `foundry/umami/README.md` (the Umami deployment) lives in the `foundry` repo, outside this
  one. Link it here or copy the route table above when that file is next edited.
- If the security headers change, keep `https://analytics.imapps.uk` in `frame-ancestors`;
  dropping it blanks every heatmap. Do not make the session cookie `SameSite=None` to solve
  this: it widens CSRF exposure for all users to fix an operator-only view.
