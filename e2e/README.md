# E2E tests

Playwright suite in this directory. Run via `bun run test:e2e` (all projects) from the repo root.

See [COVERAGE.md](COVERAGE.md) for which feature is covered by which spec, and the known gaps.

## What the suite runs against (and why it is fast)

- **A prebuilt web bundle, not the Vite dev server.** Playwright starts `bun run --filter @tandra/web start:e2e`:
  `vite build --mode development` into `packages/web/build-e2e`, served by `vite preview` on :4000 (same `/api` proxy,
  same nginx-mirror middleware as the dev server). Every test opens a fresh browser context, and the dev server made
  each one fetch and transform the whole unbundled module graph. `--mode development` keeps the `vlocalhost` badge the
  visual baselines expect. Locally, an already-running dev server on :4000 is reused instead.
- **Playwright polls every 100ms, not 500ms.** `patches/playwright-core@<version>.patch` (applied by `bun install` via
  `patchedDependencies`) caps the retry back-off of assertions and actions at 100ms. Upstream re-checks after 0, 20,
  50, 100, 100ms and then only every 500ms, so a page that rendered at ~650ms was seen at ~1000ms; most first
  actions after a `goto` and most clicks in a freshly opened drawer paid that slack. Polling is not configurable
  ([microsoft/playwright#26837](https://github.com/microsoft/playwright/issues/26837)). When upgrading
  `@playwright/test`, regenerate it: `bun patch playwright-core@<new>`, change the two arrays (`const waitTime =` in
  `_retryAction`, `const backoffScale =` in `retryWithProgressAndBackoff`) to end in `100`, `bun patch --commit
  node_modules/playwright-core`, and delete the old patch. A stale patch is skipped silently by `bun install`: the
  suite still passes, just slower.

## Projects

- `chromium` — desktop functional tests (`e2e/tests/*.spec.ts`, excluding `*.visual.spec.ts`).
- `mobile-visual` — screenshot-diff regression tests at a mobile viewport (`devices['Pixel 7']`), matching only `e2e/tests/*.visual.spec.ts`.
- `desktop-visual` — the same visual spec files at a desktop viewport (`devices['Desktop Chrome']`) — kept as its own project (rather than reusing `chromium`) so its screenshots land in separate `-desktop-visual-linux.png` baseline files and `chromium`'s functional tests stay screenshot-free.

Currently the visual suite covers:
- `/recipes/new` (`recipe-form.visual.spec.ts`) — added after a real bug (PR #131) where that page's layout wasted vertical space and duplicated its header, only caught by manually emulating a phone.
- `/` (`lists.visual.spec.ts`), `/recipes` (`recipes.visual.spec.ts`), `/list/:listTitle` (`items.visual.spec.ts`), `/friends` (`friends.visual.spec.ts`) — empty + populated states each.
- `/recipes/:recipeId` (`recipe-detail.visual.spec.ts`) — one populated state (no empty variant; the route requires an existing recipe).
- `/discover` and `/discover/:recipeId` (`discover.visual.spec.ts`) — results, filters open and a recipe preview, over the fixed library in `e2e/discovery-fixtures.ts`.
- `/calendar` (`calendar.visual.spec.ts`) — one fixed-date state (uses `page.clock.setFixedTime` so the baseline doesn't depend on which real-world day the test runs).
- `/login`, `/register` (`auth.visual.spec.ts`) — these two don't use the `authenticatedPage` fixture (pre-auth) and render under a different layout (`RootLayout showLayout={false}`) than every other page above.

## Functional coverage (auth + data-write audit, 2026-09)

The functional suite (`chromium` project) covers the security- and
data-integrity-critical paths:

- **Auth** — `auth.spec.ts`: login (valid credentials, validation errors, short
  username), register (valid, password mismatch), logout, and the
  unauthenticated `/` → `/login` redirect. `token-refresh.spec.ts`: a `401` from
  the API triggers a token refresh and retry rather than an immediate session
  drop (`packages/web/src/api/makeRequest`).
- **List data-write** — `lists.spec.ts` (add / rename / delete), `items.spec.ts`
  (add, toggle, edit name + quantity + unit, clear all, clear selected,
  swipe-to-delete), `bulk-add.spec.ts`, `labels.spec.ts`.
- **Recipe data-write** — `recipe-detail.spec.ts` (edit title / link /
  instructions, delete), `add-from-recipe.spec.ts` (recipe → list),
  `recipes.spec.ts`.
- **Sharing / authorization** — `sharing.spec.ts` (add + remove members, owner
  badge, confirmation), `friends.spec.ts`, `share-target.spec.ts`.
- **Offline** — `offline-sync.spec.ts` (queued writes reconcile on reconnect).

API-side authorization and validation are unit-tested under
`packages/api/src/**/*.test.ts` (Bun runner, 90% coverage threshold).

## Shared mocks (`e2e/mocks`)

Reuse these instead of hand-rolling `page.route`/`addInitScript` stubs in a spec. `mock-harness.spec.ts` exercises them.

- `ai.ts` — `mockRecipeImport`, `mockSubstitutes`, `mockSpokenItemsParse`, `mockRecipeCoverGeneration`, `mockRateLimited`. Each takes `{ ok: body }` or `{ status, error }`, plus optional `delayMs` to hold a loading state.
- `speech.ts` — `installFakeSpeech(page, script)` where script is a transcript, an error (`not-allowed`, `no-speech`, ...) or `unsupported`. Call before `goto`.
- `push.ts` — `installFakePush(page, { permission, requestResult, subscribed, vapidPublicKey })` fakes `Notification`, `PushManager`, the service-worker `ready` registration and the push API endpoints.
- `auth.ts` — signs in through the real Better Auth `/api/auth` routes (used by the `authenticatedPage` fixture).

## Discover specs and OpenSearch

`discover.spec.ts` and `discover.visual.spec.ts` search a small fixed recipe library (`e2e/discovery-fixtures.ts`) that
`global-setup.ts` writes to the e2e Mongo database and indexes into OpenSearch with the API's own
`reindex-discovery` command (and empties again on teardown). They need a dedicated OpenSearch and **skip when
`E2E_OPENSEARCH_URL` is unset**; CI sets it from an `opensearch` service container.

The variable is deliberately not `OPENSEARCH_URL`: the e2e API is always started with `OPENSEARCH_URL` taken from
`E2E_OPENSEARCH_URL`, so a developer's `.env` can never make the e2e fixtures land in a real index. Locally:

```bash
docker run -d --name os-e2e -p 127.0.0.1:19200:9200 -e discovery.type=single-node \
  -e DISABLE_SECURITY_PLUGIN=true -e OPENSEARCH_JAVA_OPTS="-Xms512m -Xmx512m" opensearchproject/opensearch:2.19.1
E2E_OPENSEARCH_URL=http://localhost:19200 bun run test:e2e
```

## Updating visual baselines

Baselines are Linux-only (they're compared against GitHub Actions' `ubuntu-latest` runner) — **never commit a baseline generated on your own machine**, even if tests pass locally. Font rendering/anti-aliasing differs enough between Linux distros to cause spurious CI failures.

To add or intentionally update a baseline:

1. Push your change. Let the `e2e` CI job run and fail (missing/mismatched snapshot is expected here).
2. Download and extract the `playwright-report` artifact from the failed run (GitHub Actions run summary → Artifacts, or `gh run download <run-id> -n playwright-report`).
3. Serve it locally with `bunx playwright show-report <extracted-dir>` — the HTML report's UI is JS-driven and does not render correctly opened directly over a plain `file://` URL.
4. In the report UI, open each failed test and look at its attachments (actual/expected/diff images). The files on disk under the artifact's `data/` subdirectory are named by content hash, not `*-actual.png`, so identify which hashed file is which by the attachment slot it's shown under in the UI — or by cross-referencing the failure log's `Expected:`/`Received:` path lines, which do name the expected baseline path even though the actual file on disk is hash-named.
5. Copy the identified image into `e2e/tests/recipe-form.visual.spec.ts-snapshots/`, named exactly as the failure output says the expected path should be.
6. Commit the PNG(s) and push. CI should now pass.

For local iteration (checking your test logic works, *not* for producing the commit) use:

```bash
bun run test:e2e:update-snapshots
```

Then delete the locally-generated snapshot files before committing — they're only for sanity-checking that the test navigates correctly and captures the right screen at both viewports.
