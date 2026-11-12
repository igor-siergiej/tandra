# Contributing to Tandra

Thanks for taking a look. This document gets a new contributor to a green test
run quickly and points at the deeper reference material in
[`AGENTS.md`](./AGENTS.md) once the basics work.

## Quick start

You need **Bun 1.x** and **Docker** (for Mongo and RustFS, the S3-compatible object store).

```bash
git clone https://github.com/igor-siergiej/tandra
cd tandra
bun install
cp .env.example .env
bun run dev:local                  # mongo + rustfs + web (:4000) + api (:4001)
```

Open <http://localhost:4000> and register a new account (3–50 character
username of letters, digits, `_` or `.`; 8+ character password). Accounts live
in your local Mongo; sign-in is built into the api (Better Auth), configured by
`BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` in `.env`.

`dev:local` refuses to run with `NODE_ENV=production`.

The full self-host stack (web + api + mongo + rustfs from published
images) lives in `selfhost/docker-compose.yml`; a single
`docker compose up -d` from there is also a valid end-to-end run.
`dev:local` is the developer ergonomics path — it skips the published web/api
images and uses HMR via Vite.

## Verifying your change

Run these from the repo root before opening a PR:

```bash
bun run lint                                       # vp check: Oxfmt + Oxlint
bunx tsc -p packages/api/tsconfig.json --noEmit    # API types
bunx tsc -p packages/web/tsconfig.app.json --noEmit # web types
bun run --filter @tandra/api test               # Bun runner; 90% coverage gate
bun run --filter @tandra/web test               # Vitest (vp test) component tests
```

End-to-end tests use Playwright:

```bash
bun run test:e2e                  # full suite; needs Docker stack + a running API
bun run test:e2e --grep "@smoke"  # smoke subset; safe to run against any deployment
```

## Project conventions

- **Commits** follow Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`)
  — enforced by `commitlint` in the `.vite-hooks` commit-msg hook. Use `bunx commit` if you'd like the
  prompts.
- **Lint and format** run through Vite+ (Oxlint and Oxfmt). Run `bun run lint:fix`
  before committing; the pre-commit hook runs `vp staged` on staged files.
  Clones made before the move to Vite+ still point git at the old Husky hooks; run
  `git config --unset core.hooksPath && bun install` once so the `.vite-hooks` ones take over.
- **Architecture** is documented in `AGENTS.md`. Read it before touching
  `domain/`, `infrastructure/`, or route handlers — clean architecture means
  services depend on interfaces, not on MongoDB or FalLlmClient directly.
- **Release notes** for user-visible changes use a `Release-Notes:` trailer at
  the end of the commit body and the PR body. See `AGENTS.md` for the format
  and what counts as user-visible.
- **Admin scripts** that need api code (DI container, Better Auth) live in
  `packages/api/scripts/` and get a root `package.json` alias. Keep their logic
  in an importable module with the store injected (see
  `packages/api/scripts/auth/lib.ts`) so the api's Bun tests cover it; the CLI
  file only parses args and wires dependencies. Anything that writes defaults
  to a dry run and takes `--apply`.
- **Licence** is AGPL-3.0-or-later. New source files don't need a header
  (this repo doesn't keep them), but the AGPL's network clause applies if
  you ship a derivative service.

## Picking a first issue

Browse issues labelled [`good first issue`](https://github.com/igor-siergiej/tandra/issues?q=is%3Aopen+label%3A%22good+first+issue%22) — they're curated to be small, contained, and instructive
about one slice of the project.

## Pull request flow

1. Branch off `main` (`feat/...`, `fix/...`, `chore/...`).
2. Push and open a PR targeting `main`. The PR template asks for the same
   information as the commit-message conventions; following it ahead of time
   saves a round trip.
3. CI runs lint → unit tests → Playwright e2e → semgrep. A failed check is the
   bot's review, not a final word — re-push once the actual issue is fixed.
4. Merge via squash once CI is green. semantic-release picks up the merged
   subject (and any `Release-Notes:` trailer) for the next version.

## Public roadmap

There's no published Gantt chart, but the maintainer triages publicly:

- **Open issues** — what people have already asked for. Filter by the
  [`good first issue`](https://github.com/igor-siergiej/tandra/issues?q=is%3Aopen+label%3A%22good+first+issue%22)
  label for small, contained starting points, or by
  [`enhancement`](https://github.com/igor-siergiej/tandra/issues?q=is%3Aopen+label%3Aenhancement)
  to see what's planned.
- **Milestones** — issues grouped by target release on the
  [milestones page](https://github.com/igor-siergiej/tandra/milestones).
- **Discussions** — proposals, design questions and "is anyone working on
  this?" threads live in
  [GitHub Discussions](https://github.com/igor-siergiej/tandra/discussions)
  so the maintainer can group related ideas before promoting any to issues.
- **Project board** — the maintainer's internal kanban board is private; if
  something isn't on the issue or milestones view above, it's not yet been
  prioritised. New issues are triaged weekly.

If you'd like something built, the fastest way to get it on the radar is to
open an issue (or a discussion if you're still scoping) and describe the
problem you're trying to solve.

## Where to ask

- Bug reports, feature requests: a GitHub issue, ideally with a minimal repro
  for bugs.
- Security reports: use the private channel in
  [`SECURITY.md`](./SECURITY.md) (GitHub private vulnerability reporting is
  enabled on this repo). Don't open a public issue for anything sensitive.
- General questions, ideas, "before I write a PR…" — open a thread in
  [GitHub Discussions](https://github.com/igor-siergiej/tandra/discussions).
