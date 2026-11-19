# Docs

Overview, configuration, scripts, testing and the deploy flow live in the root
[README](../README.md). Contributor setup and PR flow:
[CONTRIBUTING.md](../CONTRIBUTING.md).

## Diagrams

- [`diagrams/architecture.excalidraw`](diagrams/architecture.excalidraw) (open in excalidraw.com or the VS Code
  Excalidraw extension): workspaces, the web/api (+ auth) services on the `foundry` homelab (Dokploy, Traefik,
  Cloudflare tunnel with Access bypass), MongoDB / RustFS (S3-compatible object store) / OpenSearch, fal.ai, Web Push, and the CD path from GitHub
  Actions through Docker Hub to Dokploy.

## Features

| Doc | Covers |
| --- | --- |
| [qa-audit.md](qa-audit.md) | Audit of the quality gates: what was passing without checking anything, and the gates that replaced them |
| [discovery-search.md](discovery-search.md) | Discover search: Mongo `discoveryRecipes` as system of record, OpenSearch as derived index, index layout, reindex |
| [discovery-ingest.md](discovery-ingest.md) | Filling the library from the Wikibooks Cookbook (`bun run discover:ingest`) |
| [discovery-page.md](discovery-page.md) | The `/discover` page: browse, search, preview, copy |
| [discovery-publish.md](discovery-publish.md) | Publishing user recipes to Discover, reports and moderation |
| [webmcp.md](webmcp.md) | WebMCP browser-agent tools and the origin-trial token |
| [heatmap-preview.md](heatmap-preview.md) | Umami heatmaps: why the dashboard frame is signed out, the placeholder-data preview mode, which routes give a valid heatmap |

## Elsewhere in the repo

- [`../e2e/README.md`](../e2e/README.md), [`../e2e/COVERAGE.md`](../e2e/COVERAGE.md): Playwright projects, mocks, coverage.
- [`../scripts/load/README.md`](../scripts/load/README.md): k6 capacity test.
- [`../AGENTS.md`](../AGENTS.md): code layout and conventions (`Release-Notes:` trailer).
- `images/`: screenshots used by the root README.
