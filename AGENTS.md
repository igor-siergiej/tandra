# Tandra - Agent Context

## Goal

Give a household one shared place to do the shopping together, so everyone stays organised. For home cooks, make it easy to discover new recipes and to keep their own recipes in one place where they are simple to maintain and keep track of.

Use this goal to judge and prioritise work: favour changes that serve it, and question tasks that don't.

## Project Overview
Tandra is a collaborative shopping-list, recipe and calendar app (PWA) with a React frontend and a Hono API running on Bun. The project uses a monorepo structure managed with Bun workspaces.

## Architecture
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + PWA (vite-plugin-pwa)
- **Backend**: Bun + Hono + TypeScript + MongoDB (entry `packages/api/src/index.ts`, served with `Bun.serve`; no build step, the Docker image copies `src`)
- **Additional Services**: RustFS (S3-compatible object storage), OpenSearch (recipe Discover search, optional), fal.ai (FLUX.1 [schnell] images and `any-llm` for recipe import, tagging, substitutes, item aisles and voice parsing, via `FAL_KEY`)

## Requirements
- **Bun**: v1.x
- **Package manager**: Bun 1.x

## Project Structure
```
tandra/
├── packages/
│   ├── api/          # Backend API (Hono + MongoDB)
│   ├── web/          # Frontend React app
│   └── types/        # Shared TypeScript types
├── .env              # Environment variables
├── .bunfig.toml      # Bun registry configuration
├── biome.json        # Biome linter/formatter config
├── commitlint.config.js  # Conventional commit rules
├── .releaserc.json   # Semantic-release config (auto changelog & versioning)
├── package.json      # Root workspace configuration
└── bun.lock          # Dependencies lockfile
```

## Key Scripts
Run these from the root directory:

### Development
- `bun run start` - Start both frontend and API
- `bun run start:web` - Start only frontend (port 4000)
- `bun run start:api` - Start only API (port 4001)

### Code Quality
- `bun run lint` - Run Biome linter across all packages
- `bun run lint:fix` - Auto-fix Biome linting issues
- `bun run typecheck` - Type-check the API and web packages (see [Type Checking](#type-checking))

### Testing
- `bun run test` - Run the API tests (Bun native test runner). CI also enforces 90% line and function coverage via `scripts/check-coverage.js` on the lcov report (bun's own `coverageThreshold` is per file, so it can't express a global gate)
- `bun run --filter @tandra/web test` - Run web component tests (Vitest). No coverage gate: the web package has no coverage provider installed and the e2e suite is the main safety net for UI; add `@vitest/coverage-v8` and a threshold if that changes
- `bun run test:scripts` - Run the script tests (`scripts/` and `packages/api/scripts/`)
- `bun run load:local` - On-demand k6 API capacity test against a throwaway local API/DB with a mock auth verifier (not in CI; see `scripts/load/README.md`)
- API and script tests use Bun's native runner: import from `bun:test`. The API `test` scripts (and the root `bun run test`) pass `--parallel`, which runs files across one worker per CPU core and implies `--isolate`, so `mock.module`/`vi.mock` and spies on shared singletons (e.g. `config`) can't leak into other files, and files must not share mutable external state; script tests (`bun run test:scripts`) aren't isolated, so prefer injecting dependencies there. Web tests use Vitest (`vitest`).
- The root `bunfig.toml` scopes Bun's test collection to the API package, so a bare `bun test` at the root does not try to run the Playwright specs in `e2e/` or the Vitest specs in `packages/web/` under the wrong runner.

## Environment Setup
The project requires:
- MongoDB (localhost:27017)
- S3-compatible object store (RustFS) on localhost:9000 (`BUCKET_*` in `.env`)
- fal.ai API key (set `FAL_KEY`)

Environment variables are in `.env` file (development values).

## API Structure (`packages/api/`)
Clean architecture with:
- `domain/` - Business logic and repository interfaces (ListService, RecipeService, TodoService, MealPlanService, FriendService, ImageService, DiscoveryService, NotificationService, AuthorizationService, ItemCategoryService, SharedMembers, ...)
- `infrastructure/` - External integrations: `Mongo*Repository` classes, `BetterAuth` (auth config mounted at `/api/auth/*`), `BucketStore` (S3-compatible object store via `@imapps/api-utils` `ObjectStoreConnection`), `Fal*` clients (FalLlmClient plus the image/tag/substitute/category/parser wrappers), `OpenSearchDiscoveryIndex`, `WebPushSender`, `HttpPageFetcher`/`HttpImageFetcher` (SSRF-guarded via `safeFetch`), `imageProcessor`
- `interfaces/` - Hono handlers (ListHandlers, RecipeHandlers, TodoHandlers, MealPlanHandlers, ImageHandlers, DiscoveryHandlers, ...)
- `routes/` - API route definitions (every mutating route with a JSON body is wired to a Zod schema from `@tandra/types/schemas`; `routes/validation.test.ts` enforces it)
- `middleware/` - Hono middleware (auth, validateJson, aiRateLimit, notifyListChanged)
- `dependencies/` - DI container setup
- `config/` - Configuration management

Key dependencies:
- Hono for the HTTP server
- MongoDB native driver
- S3-compatible object store (RustFS) for file storage
- fal.ai for AI image and text generation
- Sharp for image processing
- `@imapps/api-utils` - Shared utilities for configuration, database connections, and logging

## Frontend Structure (`packages/web/`)
Modern React app with:
- `components/` - Reusable UI components (shadcn/ui based)
- `pages/` - Route-based page components (ListsPage, ItemsPage, LoginPage, RegisterPage)
- `hooks/` - Custom React hooks (useConfirmation, useSearch, useClickOutside, usePWA)
- `api/` - API client and utilities
- `utils/` - Helper functions (logger, version, pwa-debug)
- `contexts/` - React context providers (ThemeContext, PWAContext)

Key dependencies:
- React 19 + React Router
- Radix UI + Tailwind CSS + shadcn/ui
- TanStack Query v5 (`@tanstack/react-query`) for data fetching
- Framer Motion for animations
- react-hook-form + Zod for form validation
- `better-auth` client (`src/auth/client.ts`) behind the `src/auth` facade

## Shared Types (`packages/types/`)
Common TypeScript interfaces and types shared between frontend and backend.

## Development Workflow
1. **Starting development**: Run `bun run start` to start both services
2. **Code style**: The project uses **Biome** for linting and formatting (not ESLint)
3. **Testing**: API tests run on Bun's test runner, web tests on Vitest, browser tests on Playwright (`e2e/`)
4. **Linting before commits**: **IMPORTANT** - Run `bun run lint:fix` to fix all linting issues before committing
5. **Building**: Use `bun run --filter @tandra/web build` for production build
6. **Commit messages**: Must follow Conventional Commits (enforced by commitlint + Husky)
7. **Versioning**: Automated via semantic-release on main branch merges
8. **Release notes**: Every user-visible change adds a `Release-Notes:` trailer to its commit body (see below)

## Release Notes (`Release-Notes:` trailer)
The web app ships a "What's new" panel: tapping the version in the app bar opens
`packages/web/src/data/release-notes.json`, which is generated at release time by
`scripts/collect-release-notes.js` (run from semantic-release's `prepareCmd`).

**Any commit that changes something a user can notice MUST end its body with a
`Release-Notes:` trailer** — one sentence in plain language, describing the change
from the user's side, not the implementation's:

```
feat(web): Waste Warrior becomes a full page instead of a drawer

<technical body: what moved where, why>

Release-Notes: Use-it-up ingredient search is now a full page, so results aren't
squashed behind the keyboard.
```

Rules:
- This applies to every author — human, Claude Code, kanban-worker, any other harness.
- Put the same trailer at the end of the PR body too; PRs are squash-merged and this
  guarantees the trailer survives whichever message GitHub composes.
- Commits with no trailer fall back to their conventional-commit subject, so the panel
  is never empty — the trailer is how you stop a user-facing release note reading like
  a commit log.
- A trailer on a `chore`/`refactor`/`docs` commit forces it into the notes (use it when
  a nominally internal change is visible); those types are otherwise omitted.
- Never hand-edit `release-notes.json` for a new release; it is generated and committed
  by the release job.

The `commit-msg` hook enforces this: a `feat`, `fix` or `perf` commit without the
trailer is rejected. Run `bun run check:release-notes <file>` to check a message
without committing. The check reads the trailer with the same parser the release
notes use, so the two cannot disagree about what counts as one.

## Pre-commit Hooks (Husky)
- **pre-commit**: Runs lint-staged on `*.{ts,tsx,json}` files, then the type-check gate
- **commit-msg**: Validates commit message format via commitlint, then requires a
  `Release-Notes:` trailer on a `feat`/`fix`/`perf` commit
- **pre-push**: Runs `bun run audit` (fallow complexity and duplication audit)

## Type Checking
`bun run tsc --noEmit` type-checks **nothing**: the root `tsconfig.json` holds only
project references, so `tsc` finds no files to check. Use the gate instead:

- `bun run typecheck` — type-checks the API and web packages and fails on any type
  error that is not already in `scripts/typecheck-baseline.json`.
- `bun run typecheck:update` — rewrites the baseline. Run it only after fixing
  type errors, never to silence them; the baseline is the record of known debt.

The gate is a ratchet: the repo carries a known backlog of type errors, and the
baseline records it so a change cannot add to it. Each entry is a `file::code` pair
with a count, so moving code around does not read as a new error.

## Code Quality Checklist (Before Committing)
**Claude must perform these checks before creating any commit:**
1. **Verify**: Run `bun run verify` — lint, type-check, and every unit test suite.
   This is the single command that tells you the change is good; it stops at the
   first failure and says what to do about it. `bun run verify:fast` runs just lint
   and the type-check.
2. **Linting**: Run `bun run lint:fix` to auto-fix all Biome linting issues
3. **Type check**: Run `bun run typecheck` to verify no new TypeScript errors
4. **Tests**: Run `bun run --filter @tandra/api test` to verify all API tests pass
5. **Builds**: Verify `bun run --filter @tandra/web build` and `bun run --filter @tandra/api build` succeed
6. **Git status**: Ensure no untracked files are accidentally committed (except `.env` configs)

## Useful Commands for Claude
- **Check the whole change**: `bun run verify` — lint, type-check, and every unit test suite. Start here
- **Quick check**: `bun run verify:fast` — lint and type-check only
- Check project status: `bun run lint` and `bun run --filter @tandra/api test`
- Fix linting: `bun run lint:fix` (run before every commit)
- Type check: `bun run typecheck` (see [Type Checking](#type-checking))
- Start development: `bun run start` (or separate services as needed)
- File structure: Main code in `packages/api/src/` and `packages/web/src/`
- Types: Check `packages/types/` for shared interfaces

## Shared Utilities Integration
The project uses shared packages published to GitHub Packages (migration to public npm in progress):
- API package uses `@imapps/api-utils` for database connections, dependency injection, and logging
- Registry configured via `.bunfig.toml` (requires `NODE_AUTH_TOKEN` env var)

## Deployment & Infrastructure
Production runs as Dokploy swarm apps (`tandra-web`, `tandra-api`) on the `foundry` homelab, behind the Cloudflare tunnel:
- **App**: `https://app.tandra.uk` (Traefik: `/api/*` to the api, rest to web). Auth is built into the api at `/api/auth/*` (same-origin session cookie)
- **Landing site**: `https://tandra.uk` (separate `tandra-site` repo, CloudFront)
- See the README "CI/CD" section and `docs/homelab.md` in the `foundry` repo for the full map

## CI/CD Pipeline
Three workflows under `.github/workflows/`:

**`pr.yml`** (every pull request) — the merge gates:
1. **lint**: Biome linting (`bun run lint`) + the e2e suite's own type check (`bun run tsc:e2e`)
2. **test**: the type-check gate (`bun run typecheck`), the API tests with a 90% coverage threshold, the web tests, and the script tests
3. **e2e**: Playwright suite, including visual regression, against seeded Mongo and OpenSearch
4. **report**: publishes the Playwright report and links it from a sticky PR comment
5. **fallow-deadcode**: dead-code analysis (blocking)
6. **semgrep**: security pattern scan

**`cd.yml`** (push to `main`) — **release** (semantic-release), **build-publish**
(Docker images), **deploy** (webhooks).

**`load.yml`** (pull request, API paths only) — k6 capacity test. Informational; it
cannot block a merge.

The `lint` and `fallow-deadcode` jobs check out the `utils` submodule so their
results match what a developer sees locally.

## Related Services
- **Authentication**: Built into the api with Better Auth (`packages/api/src/infrastructure/BetterAuth`, mounted at `/api/auth/*`)
  - Username + password (argon2id), optional Google via `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`; no email
  - Session is an httpOnly same-origin cookie; `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are required
  - Admin password reset: `bun run auth:reset-password <username>`
- **Shared Utilities**: Depends on `@imapps/api-utils`
- **GitOps Deployment**: Managed via `argonaut` Kubernetes GitOps repository
- See `../im-apps-utils/CLAUDE.md` and `../argonaut/CLAUDE.md` for related service documentation
