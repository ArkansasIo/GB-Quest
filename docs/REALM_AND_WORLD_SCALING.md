# GB Quest Realm and World Scaling Architecture

**Project:** Lost Kingdom of Shadowbane Chronicles (GB Quest)  
**Repository:** `ArkansasIo/GB-Quest`  
**Status:** Proposed architecture and capacity targets; not a statement of deployed production capacity  
**Last updated:** 2026-11-03

## 1. Purpose and constraints

This document defines a scalable realm and world deployment model for the existing GB Quest project.

The game remains a **web-browser game** using the repository's existing client, data, and backend technology. This proposal does not introduce a replacement game engine, require a native client, or rewrite the browser frontend. The two-rack supercomputer is the infrastructure platform that can host, develop, test, and operate the game.

The design should let the project add worlds and realms through deployment and configuration rather than a client rewrite.

### Existing repository reality

The repository README currently describes 11 data centres and 85 worlds as **launcher-side logical destinations**. It explicitly states that these are not yet 11 data-centre deployments or 85 independently running world servers: the current backend is one shared realm service, and character selection and region-aware world routing remain future work.

The architecture below is therefore a target design to implement incrementally. Do not represent the proposed realms, worlds, or player capacities as already deployed.

## 2. Terminology

- **Global services:** Services shared across the game, such as account authentication, account/character directory, realm discovery, and global administration.
- **Realm:** A logical game environment with its own world directory and realm-level policies. A realm can contain multiple worlds.
- **World:** An independently deployable player environment with its own world runtime, player population limit, and world state.
- **Instance:** A temporary or bounded copy of a dungeon, raid, battleground, or other activity. An instance is not a permanent world.
- **Region/data centre:** A physical or cloud hosting location. A region can host services for multiple realms and worlds.
- **Concurrent players (CCU):** Players connected and active at the same time. This is different from registered accounts, total characters, or daily active users.

A realm is not itself necessarily one machine. A world is not necessarily one process forever; it may be composed of multiple cooperating services as load and gameplay requirements evolve.

## 3. Proposed initial configuration

Start with one production realm and five independently managed worlds.

| Item | Initial design target | Meaning |
|---|---:|---|
| Production realms | 1 | One realm directory and policy domain |
| Worlds per realm | 5 | Five separately deployable world environments |
| Total worlds | 5 | Initial production topology |
| CCU load-test target per world | 500 | A target to validate through representative load tests |
| Aggregate initial CCU test target | 2,500 | Sum of five 500-player test targets, not a capacity guarantee |

The 500-CCU-per-world figure is a **planning and validation target**, not a benchmark result or promise. Actual capacity depends on the workload, update frequency, network traffic, database query patterns, server implementation, hardware, and acceptable latency. Do not advertise a player limit until repeatable load tests demonstrate it.

### Example initial world lineup

| Realm | World | Initial role |
|---|---|---|
| Shadowbane | Valendria-01 | Main / general PvE |
| Shadowbane | Valendria-02 | General PvE overflow |
| Shadowbane | Valendria-03 | PvP ruleset |
| Shadowbane | Valendria-04 | PvE ruleset |
| Shadowbane | Valendria-05 | Roleplaying / community ruleset |

These are example world roles and names. The final rulesets and naming should be configured as data, not hard-coded into the browser client.

## 4. Expansion model

The deployment system should support adding a world or realm without changing the browser game's core interface.

| Stage | Realms | Worlds per realm | Total worlds | Test objective |
|---|---:|---:|---:|---|
| Development | 1 | 1 | 1 | Functional integration and persistence |
| Initial production | 1 | 5 | 5 | Validate 500 CCU per world under representative load |
| First expansion | 2 | 5 | 10 | Validate realm isolation and cross-world account/character rules |
| Growth | 5 | 10 | 50 | Validate automated provisioning and shared-service bottlenecks |
| Large-scale target | 10 | 10 | 100 | Validate regional distribution, failover, operations, and cost |

These are planning stages, not guarantees that a particular two-rack installation can sustain the largest stage. Additional compute, storage, network capacity, redundancy, and possibly additional sites may be required as the measured workload grows.

The launcher may display more destinations than are currently online, but it must clearly distinguish **available**, **maintenance**, **coming soon**, and **offline** worlds. A configured destination must not be shown as live until its health and routing checks succeed.

## 5. Service architecture

### Global control plane

- **Account service:** Registration, login, credential handling, account status, and account security.
- **Authentication/session service:** Issues and validates short-lived sessions or tokens. Secrets must not be stored in browser code.
- **Character directory:** Records character ownership and the character's assigned realm/world.
- **Realm directory:** Returns configured realms, worlds, rulesets, region, status, and connection metadata.
- **World allocator/router:** Selects an eligible world during character creation or login, subject to the character's assignment and world policy.
- **Administration/audit:** Restricted administrative operations, audit events, and operational controls.

### Per-world runtime

Each world should have a separately identifiable deployment and configuration, including:

- World ID, realm ID, region, ruleset, build version, and maintenance state.
- Player admission and connection limits.
- Authoritative validation of gameplay actions that affect persistent state.
- Character session and world-presence tracking.
- World/NPC state and scheduled world activities.
- Chat or a defined chat routing integration.
- Instance allocation for dungeons, raids, and battlegrounds where required.
- Health checks, metrics, structured logs, and graceful shutdown/draining.

The existing game systems should be integrated behind stable server APIs. The browser client remains the presentation and input layer; it must not be trusted to authoritatively award currency, items, experience, or combat outcomes.

### Shared platform services

- Persistent relational database for accounts, characters, inventory, economy, guilds, and other transactional records.
- Cache/session store for ephemeral data and frequently read state.
- Durable job/message queue for asynchronous work such as mail, notifications, scheduled tasks, and audit processing.
- Object/file storage for static assets, exports, and backup artifacts.
- Centralized logs, metrics, alerting, and tracing.

Redis or another cache is not the authoritative store for valuable player progress. Database transactions and recovery procedures must protect inventory, currency, trades, and character progression from duplication or loss.

## 6. Logical data ownership

The implementation should define ownership and consistency rules before splitting the current shared backend.

| Data domain | Recommended authority |
|---|---|
| Account credentials and account status | Global account service |
| Character ownership and home world | Character directory |
| Character progression and equipment | Assigned realm/world persistence, with transactional rules |
| Inventory and currency | Authoritative transactional persistence; never client-authoritative |
| World/NPC state | Owning world service |
| Guild membership and guild bank | Defined guild authority, with atomic item/currency operations |
| Auction house and cross-world trading | Explicit realm-wide or world-local economy service |
| Chat and presence | Chat/presence service with realm/world channel policy |
| Audit and security events | Central append-oriented audit/log pipeline |

Before implementing cross-world transfers, define a transfer transaction: lock or mark the character, validate destination eligibility, persist the source state, commit the destination state, and provide recovery for interrupted transfers. Do not allow the same character to be active in two worlds simultaneously unless the game explicitly supports that model.

## 7. Two-rack infrastructure mapping

The proposed hardware split is a logical responsibility split. Production services still require redundancy and should not depend on a single physical server.

### Rack 1 — Compute, AI, development, and test

- GPU compute for separate AI research and inference workloads.
- Asset-generation and content-processing jobs.
- Development and build runners.
- Automated browser, API, and gameplay load-test workers.
- Non-production world simulations and test environments.
- Monitoring/analytics compute where appropriate.

AI services must be optional dependencies. A GPU/AI outage must not prevent ordinary login, movement, combat, or persistence unless a specific game feature explicitly requires that service.

### Rack 2 — GB Quest hosting, databases, and storage

- Public web delivery and reverse proxy/load balancing.
- Backend API and global control-plane services.
- World runtime services.
- Primary transactional database and replicas where configured.
- Cache and message-queue services.
- Persistent asset and backup storage.
- Internal network, firewall, and power-management infrastructure.

A two-rack arrangement does not automatically provide high availability. Critical services need independent failure domains, tested backups, spare capacity, redundant power/network paths, and a recovery plan. If both racks share one power feed, switch, or storage array, that shared component remains a potential single point of failure.

## 8. Network and security boundaries

- Expose only the required public web and API entry points.
- Keep database, cache, queue, management, and storage interfaces on private networks.
- Use TLS for public connections and service-to-service authentication for internal APIs.
- Apply least-privilege service identities and separate production from development credentials.
- Rate-limit login and public APIs; protect account endpoints against credential stuffing and abuse.
- Validate every client action that changes authoritative game state.
- Keep secrets out of source control, browser bundles, logs, and build artifacts.
- Maintain administrative audit trails and a tested incident-response process.

## 9. Deployment and world lifecycle

A world should be created from a versioned configuration, not by manually editing client code.

Suggested lifecycle:

1. Define a unique realm ID and world ID.
2. Assign region, ruleset, build version, and resource profile.
3. Provision the world runtime and required persistence resources.
4. Register the world as **starting** in the realm directory.
5. Run readiness checks, database checks, and a synthetic login/gameplay test.
6. Mark it **available** only after all required checks pass.
7. Route eligible players to it.
8. Monitor latency, errors, CPU, memory, network, database load, and player count.
9. For maintenance, stop new admissions, drain sessions safely, persist state, and then stop the runtime.
10. For removal, verify player/character migration and retention requirements before decommissioning resources.

World IDs should remain stable. A restarted world should not accidentally become a different world or lose its persistent identity.

## 10. Capacity validation and scaling rules

Capacity must be measured with representative player behavior, not inferred from GPU count, storage capacity, or a theoretical player-per-server number.

For each world, test progressively (for example, 50, 100, 250, and 500 simulated concurrent clients), then repeat with realistic mixtures of:

- Idle players and movement/presence updates.
- Combat, NPC AI, and encounter activity.
- Inventory, loot, quest, and character persistence.
- Chat, guild, and social activity.
- Dungeon/raid instance creation and peak encounters.
- Login bursts, reconnects, and world shutdown/restart.
- Database failover and degraded-service scenarios.

Record at minimum:

- Concurrent sessions and successful actions per second.
- Median, p95, and p99 request/action latency.
- Server CPU, memory, event-loop or worker saturation, and network throughput.
- Database query latency, connection count, locks, and write throughput.
- Cache hit rate and queue depth/age.
- Disconnect, timeout, error, and failed-save rates.

Set acceptance thresholds before testing. A world passes only if it sustains the target for a defined soak period without unacceptable latency, error rates, data loss, or resource saturation. Re-test after significant backend, database, content, or infrastructure changes.

Scale horizontally by adding world runtimes when world-local resources are saturated. Scale shared services separately when account, directory, chat, database, cache, or queue metrics show a shared bottleneck. Adding worlds does not solve a saturated shared database.

## 11. Implementation roadmap for this repository

Implement this incrementally and preserve the existing browser game.

### Phase 1 — Document and identify current behavior
- Inventory the existing launcher, `/api/health`, `/api/realms`, account, and realm backend routes.
- Identify which data is currently in memory, file-backed, or database-backed.
- Document the current single shared realm service and its actual persistence behavior.
- Add tests for existing behavior before changing routing.

### Phase 2 — Realm/world configuration and directory
- Add versioned realm and world configuration records.
- Give every realm and world a stable ID, status, region, ruleset, and endpoint metadata.
- Make the launcher consume the directory response rather than assume that every listed destination is live.
- Preserve compatibility with the current browser client.

### Phase 3 — Character assignment and routing
- Implement character selection and explicit character-to-world assignment.
- Route login to the character's assigned world.
- Enforce one active authoritative session per character.
- Add reconnect, maintenance, and unavailable-world behavior.

### Phase 4 — Persistent data and safe transactions
- Establish durable account and character persistence.
- Add transactional inventory, currency, mail, guild-bank, and trade operations.
- Add migrations, backups, restore drills, and audit events.

### Phase 5 — Independent world deployments
- Make a world runtime configurable and independently deployable.
- Add health/readiness checks, admission control, graceful draining, and automated provisioning.
- Demonstrate that adding a sixth world does not require a browser-client rewrite.

### Phase 6 — Load testing and production hardening
- Run the staged load tests and publish measured capacity.
- Add alerting, dashboards, security controls, disaster recovery, and operational runbooks.
- Expand realms/regions only when measured demand and infrastructure capacity justify it.

## 12. Acceptance criteria

The initial architecture is ready for a controlled multi-world production trial when:

- The browser game still loads and plays through the existing web delivery path.
- The realm directory distinguishes configured worlds from healthy, available worlds.
- Five world configurations can be registered without hard-coding five destinations in the client.
- Each character has a clear authoritative realm/world assignment.
- Login and reconnect route to the correct world.
- A world can be taken into maintenance and drained without corrupting persistent state.
- Valuable state changes are validated server-side and persisted transactionally.
- A sixth world can be provisioned through configuration/deployment without rewriting the browser frontend.
- Monitoring, backup, restore, and load-test evidence exist for the deployed environment.

## 13. Capacity statement

The initial planning target is **one realm, five worlds, and a load-test goal of 500 concurrent players per world (2,500 aggregate across five worlds)**. This is not a guaranteed capacity. The actual supported number must be established by benchmark results on the deployed hardware and software.

The longer-term 10-realm/100-world example is an architectural expansion target, not a claim that the proposed two racks can host 100 worlds or one million concurrent players. Capacity, redundancy, and regional placement must be validated at each stage.

---

**Core principle:** GB Quest remains the existing browser MMORPG. The infrastructure grows around it: global services manage accounts and routing, each world is independently deployable, persistent data has clear ownership, and capacity claims are based on measured load tests.
