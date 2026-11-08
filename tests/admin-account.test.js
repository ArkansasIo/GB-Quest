import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "gbq-admin-"));
function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["backend/server.cjs"], { env: { ...process.env, HOST: "127.0.0.1", GBQ_ROOT_ID: "", GBQ_ADMIN_ID: "", GBQ_ENABLE_ADMIN: "1", ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; const timer = setTimeout(() => { child.kill(); reject(new Error("no start: " + out)); }, 8000);
    child.stdout.on("data", d => { out += d; if (out.includes("realm server on")) { clearTimeout(timer); resolve(child); } });
    child.stderr.on("data", d => { out += d; });
  });
}
const stop = child => new Promise(r => { child.on("exit", r); child.kill("SIGTERM"); });
const cli = (data, port, ...args) => { try { return { code: 0, out: execFileSync(process.execPath, ["backend/admin-cli.cjs", ...args], { env: { ...process.env, GBQ_DATA: data, PORT: port, GBQ_ROOT_ID: "", GBQ_ADMIN_ID: "", GBQ_ENABLE_ADMIN: "1" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; } catch (e) { return { code: e.status, out: String(e.stdout) + String(e.stderr) }; } };

test("first local account can claim realm root once; proxies and later claims are refused", async () => {
  const data = tmp(), port = String(20000 + Math.floor(Math.random() * 20000)), base = `http://127.0.0.1:${port}`;
  const call = async (p, { method = "GET", body, token, headers = {} } = {}) => { const r = await fetch(base + p, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body && JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  const server = await startServer({ PORT: port, GBQ_DATA: data });
  try {
    const a = (await call("/api/register", { method: "POST", body: { username: "owner", password: "owner-pass" } })).body.token;
    const b = (await call("/api/register", { method: "POST", body: { username: "guest", password: "guest-pass" } })).body.token;
    const me = (await call("/api/me", { token: a })).body;
    assert.equal(me.role, "player"); assert.equal(me.canClaimAdmin, true);
    assert.equal((await call("/api/me", { token: a, headers: { "X-Forwarded-For": "203.0.113.9" } })).body.canClaimAdmin, false, "through a proxy: not claimable");
    assert.equal((await call("/api/admin/claim", { method: "POST", token: a, headers: { "X-Forwarded-For": "203.0.113.9" } })).status, 403);
    const claim = await call("/api/admin/claim", { method: "POST", token: a });
    assert.equal(claim.status, 200); assert.equal(claim.body.role, "root");
    assert.equal((await call("/api/admin/me", { token: a })).body.role, "root");
    assert.equal((await call("/api/me", { token: b })).body.canClaimAdmin, false);
    assert.equal((await call("/api/admin/claim", { method: "POST", token: b })).status, 409, "second claim refused");
    const audit = (await call("/api/admin/audit?action=admin.claim", { token: a })).body.entries.map(e => `${e.actor}:${e.outcome}`);
    assert.deepEqual(audit.sort(), ["guest:denied", "owner:denied", "owner:success"].sort());
    // the web panel cannot change a root account
    const id = (await call("/api/me", { token: a })).body.account.id;
    assert.equal((await call(`/api/admin/players/${id}/role`, { method: "PUT", token: a, body: { role: "player" } })).status, 400);
    // the CLI refuses to edit while the server runs
    const busy = cli(data, port, "promote", "guest");
    assert.notEqual(busy.code, 0); assert.match(busy.out, /server is running/);
  } finally { await stop(server); }
});

test("admin CLI creates, promotes, lists and demotes accounts the server then honours", async () => {
  const data = tmp(), port = String(20000 + Math.floor(Math.random() * 20000)), base = `http://127.0.0.1:${port}`;
  assert.match(cli(data, port, "create", "boss", "boss-pass1").out, /Created root account boss/);
  assert.notEqual(cli(data, port, "create", "x", "short").code, 0);
  assert.match(cli(data, port, "create", "mod1", "mod1-pass1", "moderator").out, /moderator/);
  assert.match(cli(data, port, "list").out, /boss\s+root/);
  assert.match(cli(data, port, "demote", "mod1").out, /player/);
  assert.notEqual(cli(data, port, "promote", "nobody").code, 0);
  const server = await startServer({ PORT: port, GBQ_DATA: data });
  try {
    const login = await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "boss", password: "boss-pass1" }) }).then(r => r.json());
    const me = await fetch(base + "/api/admin/me", { headers: { Authorization: `Bearer ${login.token}` } }).then(r => r.json());
    assert.equal(me.role, "root"); assert.ok(me.permissions.includes("logs.view"));
    const plain = await fetch(base + "/api/me", { headers: { Authorization: `Bearer ${login.token}` } }).then(r => r.json());
    assert.equal(plain.canClaimAdmin, false, "realm already has an admin");
  } finally { await stop(server); }
  const audit = fs.readFileSync(path.join(data, "logs", "audit.log"), "utf8");
  assert.match(audit, /"via":"cli"/);
});

test("admin control plane is disabled by default, including its API and claim bootstrap", async () => {
  const data = tmp(), port = String(20000 + Math.floor(Math.random() * 20000)), base = `http://127.0.0.1:${port}`;
  const server = await startServer({ PORT: port, GBQ_DATA: data, GBQ_ENABLE_ADMIN: "0" });
  try {
    const register = await fetch(base + "/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "player1", password: "player-pass" }) });
    const account = await register.json();
    assert.equal(register.status, 201);
    const headers = { Authorization: `Bearer ${account.token}` };
    const me = await fetch(base + "/api/me", { headers }).then(r => r.json());
    assert.equal(me.role, "player");
    assert.equal(me.canClaimAdmin, false);
    assert.equal((await fetch(base + "/api/admin/me", { headers })).status, 404);
    assert.equal((await fetch(base + "/api/admin/claim", { method: "POST", headers })).status, 404);
    assert.equal((await fetch(base + "/admin")).status, 404);
    assert.equal((await fetch(base + "/admin/controlplane.js")).status, 404);
  } finally { await stop(server); }
});

test("admin CLI refuses all commands unless explicitly enabled", () => {
  const data = tmp();
  let output = "";
  try {
    output = execFileSync(process.execPath, ["backend/admin-cli.cjs", "list"], { env: { ...process.env, GBQ_DATA: data, GBQ_ENABLE_ADMIN: "0" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) { output = String(e.stderr); }
  assert.match(output, /Admin CLI is disabled/);
});
