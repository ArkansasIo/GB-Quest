import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const compose = readFileSync(new URL("../compose.cluster.yaml", import.meta.url), "utf8");
const nginx = readFileSync(new URL("../ops/nginx/gbquest-cluster.conf", import.meta.url), "utf8");
const docs = readFileSync(new URL("../docs/MMORPG_MULTIPLAYER_CLUSTER.md", import.meta.url), "utf8");

test("cluster compose declares three separately identified authoritative MMO nodes", () => {
  for (const name of ["mmorpg-1:", "mmorpg-2:", "mmorpg-3:"]) assert.ok(compose.includes(name), name);
  assert.match(compose, /GBQ_SERVER_INSTANCE_ID: mmorpg-2/);
  assert.match(compose, /GBQ_SERVER_INSTANCE_ID: mmorpg-3/);
  assert.match(compose, /service_completed_successfully/);
  assert.match(compose, /gbquest-cluster-postgres/);
});

test("cluster gateway supports WebSocket upgrades and balances across all MMO nodes", () => {
  for (const name of ["mmorpg-1:8788", "mmorpg-2:8788", "mmorpg-3:8788"]) assert.ok(nginx.includes(name));
  assert.match(nginx, /least_conn/);
  assert.match(nginx, /proxy_set_header Upgrade/);
  assert.match(nginx, /proxy_set_header Connection/);
});

test("cluster documentation explains TLS and shared-database operating limits", () => {
  assert.match(docs, /PostgreSQL/);
  assert.match(docs, /TLS/);
  assert.match(docs, /NOTIFY/);
  assert.match(docs, /not a measured concurrent-player benchmark/);
});
