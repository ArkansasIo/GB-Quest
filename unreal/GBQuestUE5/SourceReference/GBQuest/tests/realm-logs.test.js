import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createAuditLog, createDebugLog, redact, redactString } = require("../backend/logs.cjs");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "gbq-logs-"));
const TOKEN = "ab".repeat(32);

test("redaction removes passwords, tokens and hashes before anything is written", () => {
  assert.deepEqual(redact({ username: "ana", password: "hunter22", nested: { newPassword: "x", salt: "s" } }),
    { username: "ana", password: "[redacted]", nested: { newPassword: "[redacted]", salt: "[redacted]" } });
  assert.equal(redactString(`/api/stream?token=${TOKEN}&x=1`), "/api/stream?token=[redacted]&x=1");
  assert.equal(redactString(`Bearer ${TOKEN}`), "Bearer [redacted]");
  assert.equal(redactString(`session ${TOKEN} expired`), "session [redacted] expired");
});

test("audit log chains entries, resumes after restart, filters, and detects tampering", () => {
  const dir = tmp();
  let audit = createAuditLog({ dir });
  audit.record({ action: "auth.login", actor: "ana", ip: "1.2.3.4" });
  audit.record({ action: "auth.login", actor: "bo", outcome: "failure", details: { password: "leak" } });
  audit = createAuditLog({ dir }); // reopen: the chain must continue, not restart
  audit.record({ action: "admin.ban", actor: "root", target: "bo" });
  assert.equal(audit.seq, 3);
  assert.deepEqual(audit.verify(), { ok: true, checked: 3, head: audit.query({ limit: 1 })[0].hash, lastSeq: 3 });

  assert.deepEqual(audit.query({ action: "auth" }).map(e => e.actor), ["bo", "ana"]);
  assert.deepEqual(audit.query({ outcome: "failure" }).map(e => e.seq), [2]);
  assert.deepEqual(audit.query({ actor: "ROOT" }).map(e => e.action), ["admin.ban"]);
  assert.equal(audit.query({ action: "auth.login" }).length, 2);
  assert.equal(audit.query({ action: "admin.b" }).length, 0, "prefixes match whole segments only");
  assert.equal(audit.query({ outcome: "failure" })[0].details.password, "[redacted]");
  assert.ok(!fs.readFileSync(audit.file, "utf8").includes("leak"));

  // edit an entry in place
  const lines = fs.readFileSync(audit.file, "utf8").trim().split("\n");
  fs.writeFileSync(audit.file, lines.map((l, i) => i === 1 ? l.replace('"failure"', '"success"') : l).join("\n") + "\n");
  assert.deepEqual(audit.verify(), { ok: false, checked: 1, file: "audit.log", seq: 2, error: "entry was modified" });
  // delete an entry
  fs.writeFileSync(audit.file, [lines[0], lines[2]].join("\n") + "\n");
  const removed = audit.verify();
  assert.equal(removed.ok, false); assert.equal(removed.seq, 3); assert.match(removed.error, /removed or changed/);
});

test("audit log rotation keeps the chain verifiable across files", () => {
  const dir = tmp(), audit = createAuditLog({ dir, maxBytes: 600, keep: 50 });
  for (let i = 0; i < 20; i++) audit.record({ action: "save.write", actor: "ana", target: `slot ${i % 3}` });
  assert.ok(fs.existsSync(audit.file + ".1"), "rotated");
  const v = audit.verify();
  assert.equal(v.ok, true); assert.equal(v.checked, 20);
  assert.equal(audit.query({ limit: 50 }).length, 20);
});

test("debug log honours levels, redacts, rotates and tails newest first", () => {
  const dir = tmp(), log = createDebugLog({ dir, level: "info", echo: false, maxBytes: 400, keep: 3 });
  log.debug("hidden");
  log.info("request", { path: `/api/stream?token=${TOKEN}` });
  log.warn("slow request", { ms: 1500 });
  log.error("boom", new Error("disk full"));
  const all = log.tail();
  assert.deepEqual(all.map(e => e.level), ["error", "warn", "info"]);
  assert.equal(all[0].err.message, "disk full"); assert.match(all[0].err.stack, /Error: disk full/);
  assert.equal(all[2].path, "/api/stream?token=[redacted]");
  assert.deepEqual(log.tail({ level: "warn" }).map(e => e.msg), ["boom", "slow request"]);
  assert.deepEqual(log.tail({ q: "SLOW" }).map(e => e.msg), ["slow request"]);
  log.setLevel("debug"); log.debug("now visible"); assert.equal(log.tail({ limit: 1 })[0].msg, "now visible");
  for (let i = 0; i < 30; i++) log.info("filler " + i);
  log.flush();
  assert.ok(fs.existsSync(log.file + ".1"));
  assert.equal(log.tail({ limit: 1 })[0].msg, "filler 29");
});

// ---------------------------------------------------------------- end to end against the realm server
function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["backend/server.cjs"], { env: { ...process.env, HOST: "127.0.0.1", GBQ_LOG_QUIET: "0", ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("server did not start: " + out)); }, 8000);
    child.stdout.on("data", d => { out += d; if (out.includes("realm server on")) { clearTimeout(timer); resolve(child); } });
    child.stderr.on("data", d => { out += d; });
    child.on("exit", code => { clearTimeout(timer); reject(new Error(`server exited ${code}: ${out}`)); });
  });
}
const stop = child => new Promise(r => { child.removeAllListeners("exit"); child.on("exit", r); child.kill("SIGTERM"); });

test("realm server writes audit and debug logs and exposes them to staff", async () => {
  const data = tmp(), port = String(20000 + Math.floor(Math.random() * 20000)), base = `http://127.0.0.1:${port}`;
  const call = async (p, { method = "GET", body, token } = {}) => {
    const r = await fetch(base + p, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
    return { status: r.status, reqId: r.headers.get("x-request-id"), body: await r.json().catch(() => ({})) };
  };
  let server = await startServer({ PORT: port, GBQ_DATA: data });
  let root;
  try {
    root = await call("/api/register", { method: "POST", body: { username: "rootacct", password: "correct-horse" } });
    assert.equal(root.status, 201); assert.match(root.reqId, /^[0-9a-f]{12}$/);
    const player = await call("/api/register", { method: "POST", body: { username: "player1", password: "player-pass" } });
    assert.equal((await call("/api/login", { method: "POST", body: { username: "player1", password: "wrong-pass" } })).status, 401);
    assert.equal((await call("/api/login", { method: "POST", body: { username: "ghost", password: "whatever1" } })).status, 401);
    assert.equal((await call("/api/admin/me", { token: player.body.token })).status, 403); // routine probe: not audited
    assert.equal((await call("/api/admin/audit", { token: player.body.token })).status, 403);
    for (const bad of ["null", "[]", "7"]) { // non-object bodies are rejected, not 500s
      const r = await fetch(base + "/api/hero", { method: "PUT", headers: { Authorization: `Bearer ${player.body.token}` }, body: bad });
      assert.equal(r.status, 400, `body ${bad}`);
    }
    assert.equal((await call("/api/saves/0", { method: "PUT", token: player.body.token, body: { state: { name: "Hero", cls: "fighter", lvl: 3 } } })).status, 200);
    // This child is force-terminated on Windows; wait for the server's batched save to reach disk before restarting it.
    const realmFile = path.join(data, "realm.json");
    const deadline = Date.now() + 2500;
    let durable = false;
    while (Date.now() < deadline) {
      try {
        const saved = JSON.parse(fs.readFileSync(realmFile, "utf8"));
        durable = !!saved.accounts.rootacct && !!saved.accounts.player1 && !!saved.saves[player.body.account.id];
      } catch {}
      if (durable) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(durable, "account and save writes reached the realm file before restart");
  } finally { await stop(server); }

  // restart with the first account as root; the audit chain must carry on
  server = await startServer({ PORT: port, GBQ_DATA: data, GBQ_ROOT_ID: root.body.account.id, GBQ_LOG_LEVEL: "debug" });
  try {
    const login = await call("/api/login", { method: "POST", body: { username: "rootacct", password: "correct-horse" } });
    assert.equal(login.status, 200, `root login response: ${JSON.stringify(login.body)}`);
    const token = login.body.token;
    const auditResponse = await call("/api/admin/audit?limit=100", { token });
    assert.equal(auditResponse.status, 200, `audit endpoint response: ${JSON.stringify(auditResponse.body)}`);
    const all = auditResponse.body.entries;
    const actions = all.map(e => `${e.action}:${e.outcome}`).reverse();
    for (const want of ["server.start:success", "auth.register:success", "auth.login:failure", "admin.access:denied", "save.write:success"]) assert.ok(actions.includes(want), `missing ${want} in ${actions}`);
    assert.equal(actions[actions.length - 1], "auth.login:success");
    const failures = (await call("/api/admin/audit?action=auth.login&outcome=failure", { token })).body.entries;
    assert.deepEqual(failures.map(e => e.details.reason).sort(), ["unknown_account", "wrong_password"]);
    assert.equal(failures[0].ip, "127.0.0.1");
    const denied = (await call("/api/admin/audit?action=admin.access", { token })).body.entries;
    assert.deepEqual(denied.map(e => [e.actor, e.target]), [["player1", "GET /api/admin/audit"]]);

    const verify = await call("/api/admin/audit/verify", { token });
    assert.equal(verify.body.ok, true); assert.ok(verify.body.checked >= 8);

    const setLevel = await call("/api/admin/logs/level", { method: "PUT", token, body: { level: "debug" } });
    assert.equal(setLevel.body.level, "debug");
    const probe = await call("/api/me", { token });
    const logs = (await call(`/api/admin/logs?q=${probe.reqId}`, { token })).body;
    assert.equal(logs.entries[0].reqId, probe.reqId); assert.equal(logs.entries[0].status, 200); assert.equal(logs.entries[0].account, "rootacct");

    // nothing secret on disk
    const disk = fs.readdirSync(path.join(data, "logs")).map(f => fs.readFileSync(path.join(data, "logs", f), "utf8")).join("");
    for (const secret of ["correct-horse", "player-pass", "wrong-pass", token]) assert.ok(!disk.includes(secret), `leaked ${secret.slice(0, 6)}…`);
  } finally { await stop(server); }
});
