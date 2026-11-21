# API capacity test (k6)

Finds how many concurrent user sessions the tandra API handles before latency or errors leave budget.
Run it locally on demand, or let the `Load` workflow run a short gated version on PRs (see "CI").

```bash
bun run load:local                       # ~4.5 min, needs docker, bun, the dev-mongodb container
STEPS=100,200,300 STEP_DURATION=20s bun run load:local
```

`run-local.sh` starts everything it needs and tears it down afterwards:

| Piece | What it is |
|---|---|
| API | `packages/api` on `:4101`, started with `env -i` (no `FAL_KEY` or `GEMINI_API_KEY`, no OpenSearch, nothing from `.env` except the Mongo URI) |
| Auth | the throwaway API's own Better Auth (`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` set); k6 `setup()` signs each fixture user up via `POST /api/auth/sign-up/email` and sends the returned session cookie on every call |
| Database | throwaway `tandra_k6` on the local dev Mongo; dropped on exit. The runner refuses non-localhost Mongo URIs |
| k6 | `grafana/k6` in Docker with `--network host`; no local k6 install |

Output lands in `scripts/load/results/<timestamp>/` (gitignored): `report.txt`, `summary.json`, `container-cpu.csv`, `api.log`.

## What a run does

- `setup()` creates `USERS` fixture users (`k6-<run>-user-N`), each owning `LISTS_PER_USER` lists with `ITEMS_PER_LIST` items and `RECIPES_PER_USER` recipes of `INGREDIENTS_PER_RECIPE` ingredients, plus `BACKGROUND_LISTS` lists and `BACKGROUND_RECIPES` recipes owned by one more fixture user so lookups run against realistic collection sizes. Everything goes through the public API; no real user's data is read or written.
- `teardown()` deletes every list and recipe it created, then checks `/api/metrics` for AI calls.
- The load is an open-model ramp (`ramping-arrival-rate`) of *sessions per second*, one step per entry in `STEPS`. A session is: `GET /api/lists/user/:id`, `GET /api/lists/title/:title`, in 50% of sessions (`RECIPES_SHARE`) `GET /api/recipes` and `GET /api/recipes/:id`, and in 35% of sessions (`MUTATION_SHARE`) add item, toggle it, delete it, re-read the list (~3.5-6 requests per session).
- Every request is tagged with its step, so the report gives p50/p95/p99, error rate, lost updates, API CPU and event-loop lag per step, then names the **cap** (last step inside budget) and the **first breach**. A second table gives p50/p95/p99 per route at one step below the cap (`ROUTE_REPORT_RATE`, default 150 sessions/s).
- Budget: `P95_MS` (default 300) and `ERROR_RATE` (default 1%). By default the exit code stays 0 (measurement). Set `GATE_RATE=<sessions/s>` to turn the budget into a hard threshold (exit 99) for every step at or below that rate, for use as a regression gate.

## Auth: what the number includes

Auth is the API's built-in Better Auth: each sign-up uses a distinct `X-Forwarded-For` so the sign-up rate limiter (3 per 10 s per IP) doesn't throttle setup, and every scenario request carries a real session cookie, so session lookup cost is included in the numbers.

## Zero AI spend

The script never calls `/api/recipes/import`, `/image/generate` or `/api/recipes/substitutes`, and the API in `run-local.sh` has no AI keys. Independently, `teardown()` diffs the server's own counters (`tandra_api_http_requests_total` for those routes, `tandra_images_generated_total`) against a baseline taken in `setup()`. The `ai_calls_detected` and `ai_check_unavailable` thresholds fail the run if either moved or the check could not be made.

## Targets

`BASE_URL` may only be `localhost`, `127.0.0.1` or `host.docker.internal`; anything else aborts. There is no staging deployment of tandra, and production must never be load tested. Everything runs against a throwaway API and database.

## CI

`.github/workflows/load.yml` (workflow `Load`) runs on PRs that touch `packages/api/**`, `packages/types/**` or this directory, and on manual dispatch. It uses a Mongo service container, runs two steps (100 and 150 sessions/s, 20 s each) and fails with exit 99 if p95 >= 100 ms or errors >= 1% at either. Both steps are well below the ~200 sessions/s cap, where local p95 is 5-10 ms, so the gate catches order-of-magnitude regressions (a reintroduced collection scan, an N+1) and not small drifts: shared runners are too noisy for that. The report goes to the job summary and a `k6-report` artifact.

It is intentionally not in `kanban-cli`'s `ci.workflowNames` / `checkNamesRequired`, so it cannot block a merge. Make it a required check in branch protection once its numbers have proven stable on real runs. A stricter option is an A/B run (base and head back to back on the same runner, failing on a relative p95 increase); it doubles the runtime and is not built.

## Benchmarks

Local, isolated auth, budget p95 < 300 ms, 30 s per step. Host: 4 cores shared with the homelab's other containers and other agents' work (load average 2-6), so absolute numbers are indicative and run-to-run noise is real: p95 at the same step has ranged 10-136 ms between runs of identical code. Compare rows within one table, not across tables.

**Lists only** (50 users x 5 lists x 15 items + 2000 background lists; sessions without recipe reads):

| Date | Variant | Cap (sessions/s, ~req/s) | p95 at cap | First breach | Lost updates per step | Mongo CPU |
|---|---|---|---|---|---|---|
| 2026-10-08 | no indexes on `list` | 200 (~720) | 225 ms | 300: p95 1.7 s | 0, 2, 4, 36, 518, 1122, 1091 | 100-120% (saturated) |
| 2026-10-08 | indexes added by hand to the throwaway DB | 200 (~730) | 9 ms | 300: p95 0.8 s | 0, 0, 0, 4, 250, 1318, 1236 | 55-75% |
| 2026-10-09 | list indexes created at startup | 200 (~716) | 111 ms | 300: p95 1.4 s | 0, 0, 0, 8, 599, 1190, 1219 | 87% peak |
| 2026-10-09 | + compare-and-swap list writes | 200 (~684) | 248 ms | 300: p95 3.0 s, 0.06% errors | **0 at every step** | 77% peak |

**With recipe reads** (adds 10 recipes per user + 5000 background recipes; 50% of sessions read `GET /api/recipes` and `GET /api/recipes/:id`; steps 100/150/200), 150 sessions/s step, local box at load average 3.4-5.4 (the runs were not on a quiet host, so read the table as noise, not as a comparison):

| Variant | req/s | p95 all requests | p95 `GET /api/recipes` | p95 `GET /api/recipes/:id` |
|---|---|---|---|---|
| control: `RECIPES_SHARE=0` (no recipe reads) | 448 | 24 ms | - | - |
| recipe reads, no recipe indexes | 574 | 103 ms | 80 ms | 109 ms |
| recipe reads, recipe indexes | 581 | 136 ms | 94 ms | 133 ms |

Throughput plateaus at ~700-1000 req/s in every variant; past that, extra offered load only adds queueing.

What this says:

1. **The limit is the single API process.** Bun runs the API on one thread; it reaches ~0.8-0.9 cores at the plateau and event-loop p99 lag climbs from 3 ms to 100-180 ms. Adding replicas is the lever, not Mongo.
2. **Missing list indexes cost latency, not throughput.** Without indexes on `list.title` and `list.users.id` every request scanned the collection: below the knee (150 sessions/s) p95 was 23 ms without indexes vs 5-10 ms with. The API creates them at startup, so production gets them on the next deploy.
3. **Lost updates are fixed.** Item edits used to be read-modify-write on the whole list document, so concurrent edits to one list overwrote each other (a toggle or delete got a 404 for an item the same session had just added; up to 1300 per step). Every such write is now a compare-and-swap on a `revision` counter (`ListService.modifyList`, `ListRepository.replaceIfUnchanged`): a write that lost the race re-reads and retries, up to 8 times, then answers 503. `lost` is 0 at every step. The price shows only past the cap: queueing stretches the read-to-write window, and 64 requests (of tens of thousands) hit 503 in the overloaded steps. `ListService/concurrency.test.ts` reproduces the race deterministically.
4. **Recipe indexes remove the Mongo scan but this harness cannot show a latency win.** Query plan on 5000 recipes: `users.id` goes from a full collection scan (5000 documents, 7 ms) to an index fetch (50 documents, 1 ms); `id` lookups from 5000 documents to 1. End to end, the two recipe rows above differ by less than the run-to-run noise, because the API thread saturates before Mongo does. The scan cost grows linearly with the collection, so the index is insurance against growth rather than a measured speed-up today.
5. **The ~100 ms p95 in the recipe-read rows is host contention, not recipe cost.** The first version of this note blamed the recipe endpoints. The same session mix (recipe reads, recipe indexes, compare-and-swap list writes) on a GitHub runner in the `Load` workflow gives p95 1-3 ms on every route at 150 sessions/s, so the local gap came from other work on the shared box. Benchmark on a quiet host, or use the `Load` run, before drawing conclusions from small differences.

## Not done yet

- **Recipe writes.** `MongoRecipeRepository.update` replaces the whole document, which is likely (not measured) the same lost-update pattern as lists were when it races `addUser` / `removeUser` / `setCoverImageKey`. The k6 session does not write recipes.
- **Prometheus/Grafana panel on the tank host.** The local runs read the same `/api/metrics` series via the sampler scenario; attach the Grafana panel for a run's time window if the API is ever load tested in a deployed environment.
