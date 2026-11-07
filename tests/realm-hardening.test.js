import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

// Regression tests for realm server input handling (backend/server.cjs).
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "gbq-harden-"));
function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["backend/server.cjs"], { env: { ...process.env, HOST: "127.0.0.1", GBQ_ROOT_ID: "", GBQ_ADMIN_ID: "", ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; const timer = setTimeout(() => { child.kill(); reject(new Error("no start: " + out)); }, 8000);
    child.stdout.on("data", d => { out += d; if (out.includes("realm server on")) { clearTimeout(timer); resolve(child); } });
    child.stderr.on("data", d => { out += d; });
  });
}
const stop = child => new Promise(r => { child.on("exit", r); child.kill("SIGTERM"); });

test("realm server rejects prototype names, junk ids, oversized presence and bad leaderboard values", async () => {
  const data = tmp(), port = String(20000 + Math.floor(Math.random() * 20000)), base = `http://127.0.0.1:${port}`;
  const call = async (p, { method = "GET", body, token } = {}) => {
    const r = await fetch(base + p, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const server = await startServer({ PORT: port, GBQ_DATA: data });
  try {
    // names that collide with Object.prototype members are ordinary names
    for (const name of ["constructor", "__proto__"]) {
      const login = await call("/api/login", { method: "POST", body: { username: name, password: "password1" } });
      assert.equal(login.status, 401, `login ${name}: no account yet, not a server error`);
    }
    const reg = await call("/api/register", { method: "POST", body: { username: "constructor", password: "password1" } });
    assert.equal(reg.status, 201, "constructor is not taken");
    assert.equal((await call("/api/login", { method: "POST", body: { username: "constructor", password: "password1" } })).status, 200);

    const token = (await call("/api/register", { method: "POST", body: { username: "alice", password: "password1" } })).body.token;
    const fresh = (await call("/api/register", { method: "POST", body: { username: "bob", password: "password1" } })).body.token;
    assert.equal((await call("/api/friends/request", { method: "POST", token: fresh, body: { username: "__proto__" } })).status, 404);

    // a listing id of __proto__ is not a listing
    assert.equal((await call("/api/market/buy", { method: "POST", token, body: { id: "__proto__" } })).status, 404);
    assert.equal((await call("/api/market/cancel", { method: "POST", token, body: { id: "constructor" } })).status, 404);
    assert.deepEqual((await call("/api/market/claim", { token: fresh })).body, { gold: 0, returned: [] });

    // removing a friend who does not exist is refused instead of storing an empty entry
    assert.equal((await call("/api/friends/remove", { method: "POST", token, body: { accountId: "junk" } })).status, 404);

    // leaderboard numbers are clamped to whole, finite values
    assert.equal((await call("/api/hero", { method: "PUT", token, body: { lvl: 5, tower: -5, ach: "1e400", rating: -99999, ch: "x" } })).status, 200);
    const hero = (await call("/api/heroes", { token })).body.heroes.find(h => h.account === "alice");
    assert.deepEqual({ lvl: hero.lvl, tower: hero.tower, ach: hero.ach, rating: hero.rating, ch: hero.ch }, { lvl: 5, tower: 0, ach: 0, rating: 0, ch: 0 });

    // presence is capped; a normal game presence still works
    const stream = await fetch(`${base}/api/stream?token=${token}`);
    const reader = stream.body.getReader(); let text = "";
    while (!/"peer":"[0-9a-f]+"/.test(text)) text += new TextDecoder().decode((await reader.read()).value);
    const peer = text.match(/"peer":"([0-9a-f]+)"/)[1];
    assert.equal((await call("/api/presence", { method: "POST", token, body: { peer, presence: { pad: "a".repeat(5000) } } })).status, 413);
    assert.equal((await call("/api/presence", { method: "POST", token, body: { peer, presence: { n: "ALICE", z: "town", x: 3, y: 4 } } })).status, 200);
    await reader.cancel();

    // wrong current passwords on a signed-in session are throttled like logins
    let last;
    for (let i = 0; i < 11; i++) last = await call("/api/password", { method: "POST", token: fresh, body: { oldPassword: "wrong-pass", newPassword: "newpassword1" } });
    assert.equal(last.status, 429);
    // The realm batches disk writes on a one-second timer. Windows terminates a
    // child process directly on kill(), so it cannot run the SIGTERM flush hook.
    await new Promise(resolve => setTimeout(resolve, 1100));
  } finally { await stop(server); }

  const db = JSON.parse(fs.readFileSync(path.join(data, "realm.json"), "utf8"));
  assert.ok(!Object.hasOwn(db.friendRequests, "junk"), "no junk friendRequests key");
  assert.ok(!Object.hasOwn(db.proceeds, "undefined"), "no phantom seller proceeds");
});
