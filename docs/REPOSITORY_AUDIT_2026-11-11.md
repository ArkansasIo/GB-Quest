# GB-Quest repository audit — 2026-11-11

## Scope and method

Reviewed the `main` branch at `06b5c39df6e4e4f03ce90d77ab40e12e7294722c` (release v2.8.0), repository tree, package scripts, GitHub Actions workflow, browser boot tests, PostgreSQL integration tests, MMO security helpers, whisper routes, schema migrations, both backend entry points, and Docker Compose deployment files.

This is a source/configuration audit. It is not a claim that the full game was executed locally. GitHub Actions results are reported separately from local execution.

## Current verification

- Main-branch test workflow: passed for v2.8.0.
- Main-branch itch.io HTML5 build: passed for v2.8.0.
- Main-branch source-package workflow: passed for v2.8.0.
- Main-branch Java Edition workflow: passed for v2.8.0.
- PR #24 (War Plans / Seals / 72 endgame activities / quarterly seasons): open, not merged; its six CI jobs passed on its feature-branch head.
- The project provides a broad Node test suite, a PostgreSQL/WebSocket integration test, C++ native tests, an asset-generation pipeline, and a browser sweep using Playwright.

## Findings

### P1 — Standalone MMO Compose file publishes the game server on every host interface

`docker-compose.mmorpg.yml` used `8788:8788`, which exposes the MMO HTTP/WebSocket port on all host interfaces by default. The primary `compose.yaml` correctly defaults to `127.0.0.1`. This discrepancy contradicts the deployment guidance that the service should sit behind a TLS reverse proxy and remain bound to localhost.

**Change in this branch:** make the standalone compose file use `GBQ_BIND_ADDRESS` and `GBQ_PORT`, defaulting to `127.0.0.1:8788`. PostgreSQL remains un-published.

### P1 — MMO backend and game progression contracts are materially narrower than the game design

The authoritative PostgreSQL schema currently constrains characters to six classes and levels 1–100, while the browser game documents 16 classes and progression to level 720. The backend deployment guide also explicitly lists missing production systems, including complete ability/status combat, general loot tables, production collision/navigation, moderation, and distributed presence. These are integration gaps, not cosmetic omissions.

**Recommendation:** version the game-to-server contract and implement progression/class migrations before treating the authoritative MMO backend as feature-equivalent to the browser game. Do not silently clamp a level-720 hero into the current schema.

### P1 — Multiple backend modes create operational ambiguity

The repository contains a JSON-file realm backend (`backend/server.cjs`) and a separate PostgreSQL authoritative MMO service (`backend/mmorpg-server.cjs`). They have different account/session models, persistence layers, endpoints, and feature coverage. The README and deployment docs distinguish them, but the package scripts (`server`, `mmorpg:server`, `start`) make it easy to start a different service than intended.

**Recommendation:** keep both modes only if intentional; add an explicit architecture decision record, label the launch scripts as legacy/local realm versus PostgreSQL MMO, and document which client features use which API.

### P2 — Horizontal scaling is not production-ready

The PostgreSQL MMO service tracks connected sockets and zone presence in process memory. Running multiple replicas behind a load balancer would split presence and broadcasts. The deployment guide correctly acknowledges this.

**Recommendation:** introduce shared pub/sub and presence (e.g. Redis), explicit zone ownership, reconnect/session coordination, and distributed rate limiting before enabling multiple replicas.

### P2 — Automated syntax coverage is not comprehensive

The `check:syntax` package script and CI syntax step enumerate selected files rather than discovering all runtime JavaScript modules. New files can be omitted from syntax validation unless manually added. The browser sweep and targeted tests help, but do not replace a full source syntax pass.

**Recommendation:** add a deterministic script that enumerates tracked JavaScript files while excluding generated/vendor directories, and run `node --check` for each compatible file. Keep special handling for browser-inline scripts and CommonJS/ESM boundaries.

### P2 — Seasonal progression is not yet authoritative multiplayer data

PR #24 explicitly states that seasonal journey, weekly objectives, currency, renown and event claims currently persist in local character saves. They are not server-validated in PostgreSQL, and the season rank is personal/local rather than a cross-realm leaderboard.

**Recommendation:** treat seasonal reward claims as offline/local until server-side idempotency, reset windows, event participation validation, and reward ledger transactions are implemented.

### P3 — Token and session lifecycle needs a production policy

The PostgreSQL service issues signed 30-day bearer tokens. The inspected implementation validates expiry and disabled-account state, but a complete production session lifecycle also needs explicit logout/revocation, secret rotation strategy, refresh/re-authentication UX, and session inventory/audit controls.

**Recommendation:** document token revocation semantics and implement server-side session identifiers or token-version invalidation before public account rollout.

## Recommended execution order

1. Keep the standalone MMO Docker port loopback-bound by default (implemented in this branch).
2. Establish a single documented backend selection and API ownership map.
3. Align character/class/level data contracts with the game progression model.
4. Add shared presence/pub-sub and zone ownership before horizontal scaling.
5. Move season, guild, trading, auction and reward claims into transactional server-owned records.
6. Expand syntax checks to every tracked runtime module and add CI coverage for deployment configuration.
7. Add operational controls: backups/restore drills, structured metrics, moderation tools, abuse detection, and token revocation.

## Validation limitations

No production database, deployed MMO host, or local checkout was available in this GitHub-only audit session. The changes in this branch are limited to deployment safety defaults, a regression test, and this audit report. The regression test is intended to run in the repository's normal Node test suite; CI must confirm it on the branch.
