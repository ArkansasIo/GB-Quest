# GB-Quest implementation backlog

This backlog is an execution plan for completing the existing project without replacing working systems. It is intentionally additive: preserve the browser game, the JSON-file realm service, the PostgreSQL MMO service, the desktop launcher, and the Unreal Engine source-reference project.

## Current architecture boundaries

| Area | Existing implementation | Rule for future work |
|---|---|---|
| Browser game | Single-file HTML5 build, browser runtime, local saves | Keep the offline/browser path playable |
| Legacy realm service | `backend/server.cjs`, JSON-backed accounts/realm data | Treat as a lightweight compatibility/local realm service |
| Authoritative MMO | `backend/mmorpg-server.cjs`, PostgreSQL, HTTP and WebSocket | Own persistent multiplayer state here |
| Character progression | Browser rules/catalogues and PostgreSQL migrations | Version the client/server contract; never silently truncate levels or remap class IDs |
| Talent trees | Job and legacy-class specialization catalogue; server-side unlock ledger | Keep unlock validation and point spending server-authoritative |
| Release | `npm run build:itch` | Keep the archive flat with a root-level `index.html` |
| Unreal reference | `unreal/GBQuestUE5` and SourceReference | Keep it a reference/port target until an Unreal build is explicitly integrated |

## Priority 0 — preserve a reproducible baseline

- [ ] Record the exact base commit and CI run for every implementation branch.
- [ ] Run `npm ci`, `npm run check:syntax`, `npm test`, and `npm run build:itch` before and after each change set.
- [ ] Keep generated output, secrets, local database files, and user save data out of commits.
- [ ] For database changes, add an ordered, rerunnable migration and a rollback/restore note.
- [ ] For every new game system, add deterministic unit tests and a client/server contract test where applicable.

Acceptance: a clean checkout can install dependencies, pass the documented checks, and produce a browser ZIP without credentials or a production database.

## Priority 1 — authoritative character and combat parity

- [ ] Publish a versioned character contract covering all playable jobs, specialization IDs, levels 1–720, attributes, equipment slots, resources, and progression currencies.
- [ ] Compare the browser and PostgreSQL rules for XP thresholds, level grants, class features, talent-point awards, and respec behavior.
- [ ] Move ability execution to server-validated commands: validate cooldowns, resource costs, range, line of sight, target eligibility, status effects, and damage before committing results.
- [ ] Make loot rolls, item ownership, currency changes, and reward claims transactional and idempotent.
- [ ] Add replayable combat fixtures so the same seed and inputs produce the same result.

Acceptance: a client cannot grant itself XP, levels, talents, currency, item ownership, cooldown resets, or combat outcomes by editing local state or sending a forged WebSocket message.

## Priority 2 — multiplayer reliability and operations

- [ ] Define zone ownership and reconnect semantics for each realm.
- [ ] Add shared event fan-out and presence coordination before running multiple MMO server replicas. PostgreSQL persistence alone is not a substitute for a deliberate live-event delivery model.
- [ ] Move rate-limit state to shared storage before horizontally scaling write endpoints.
- [ ] Add graceful shutdown: stop accepting sessions, notify clients, persist pending writes, and release zone ownership.
- [ ] Add database backup/restore drills, migration preflight, health/readiness checks, and structured operational metrics.
- [ ] Document TLS termination, trusted proxy configuration, allowed origins, firewall rules, secrets, and least-privilege database credentials.

Acceptance: two server processes can coordinate presence and zone events without duplicate character control, lost messages, or divergent authoritative state; restore instructions are tested.

## Priority 3 — game systems and seasonal content

- [ ] Keep classes, subclasses, skills, passives, items, recipes, creatures, encounters, quests, and dungeon definitions in versioned data catalogues.
- [ ] Give every content record a stable ID, schema version, localization key, source reference, and validation rule.
- [ ] Build talent nodes as data records with prerequisites, point cost, unlock level, effects, and active/passive/ultimate classification.
- [ ] Implement seasons as server-owned records with explicit start/end timestamps, reset policy, objective progress, reward ledger, and idempotent claim IDs.
- [ ] Make guild, party, trading, auction, mail, and raid rewards server-authoritative; enforce ownership and currency invariants in database transactions.
- [ ] Add migration fixtures for legacy characters and saves before changing catalogue IDs or item schemas.

Acceptance: catalogues validate in CI; rewards cannot be claimed twice; a season rollover cannot erase permanent character progression.

## Priority 4 — assets, UI, and performance

- [ ] Maintain source art separately from generated runtime atlases.
- [ ] Validate image dimensions, palette/index constraints, atlas references, animation frame counts, and missing asset IDs during the build.
- [ ] Keep the 160×144 logical display and touch/keyboard controls functional at desktop and mobile viewport sizes.
- [ ] Add a repeatable browser smoke test for boot, new character, save/load, world transition, combat, and fullscreen.
- [ ] Track compressed HTML5 ZIP size and build duration to catch release regressions.

Acceptance: generated assets are reproducible from checked-in source inputs and the browser smoke test exercises the actual built artifact.

## Priority 5 — release and distribution

- [ ] Run the release checklist in `docs/RELEASE_CHECKLIST.md` for every public build.
- [ ] Keep itch.io credentials in GitHub Actions secrets only; never place them in the repository, workflow variables, or client bundle.
- [ ] Upload the generated ZIP as a CI artifact before any optional Butler publish step.
- [ ] Test the uploaded embed on desktop and mobile, including touch controls and fullscreen.
- [ ] Keep release notes, game metadata, package version, and downloadable artifacts aligned.

Acceptance: the published build is traceable to a commit, its ZIP passes structural validation, and a manual browser smoke test is recorded.

## Change discipline

1. Inspect the existing implementation and tests before adding a replacement.
2. Prefer a small migration or adapter over a rewrite.
3. Do not merge unrelated feature branches automatically; review their changed files and test results first.
4. Never describe a planned feature as implemented, or a build as passing unless the command/CI run actually confirms it.
