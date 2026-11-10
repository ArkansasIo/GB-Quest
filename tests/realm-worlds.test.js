import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

// Realms are separate worlds on the realm server (backend/server.cjs): players, chat and battle topics
// only reach players on the same realm, and population is the live count per realm.
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "gbq-worlds-"));
function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["backend/server.cjs"], { env: { ...process.env, HOST: "127.0.0.1", GBQ_ROOT_ID: "", GBQ_ADMIN_ID: "", ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; const timer = setTimeout(() => { child.kill(); reject(new Error("no start: " + out)); }, 8000);
    child.stdout.on("data", d => { out += d; if (out.includes("realm server on")) { clearTimeout(timer); resolve(child); } });
    child.stderr.on("data", d => { out += d; });
  });
}
const stop = child => new Promise(r => { child.on("exit", r); child.kill("SIGTERM"); });

// a minimal Server-Sent Events client on fetch
async function stream(base, token) {
  const ctl = new AbortController(), res = await fetch(`${base}/api/stream?token=${encodeURIComponent(token)}`, { signal: ctl.signal });
  const events = [], reader = res.body.getReader(), dec = new TextDecoder(); let buf = "";
  (async () => { try { for (;;) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf("\n\n")) >= 0) { const block = buf.slice(0, i); buf = buf.slice(i + 2); const ev = /event: (.*)/.exec(block), da = /data: (.*)/.exec(block); if (ev && da) events.push({ event: ev[1], data: JSON.parse(da[1]) }); } } } catch {} })();
  const waitFor = async (event, pred = () => true, ms = 4000) => { const t = Date.now(); for (;;) { const k = events.findIndex(e => e.event === event && pred(e.data)); if (k >= 0) return events.splice(k, 1)[0].data; if (Date.now() - t > ms) throw new Error(`no ${event}`); await new Promise(r => setTimeout(r, 30)); } };
  const hello = await waitFor("hello");
  return { peer: hello.peer, realm: hello.realm, events, waitFor, close: () => ctl.abort() };
}

test("realms are separate worlds: players, chat and battle topics stay on their realm", async () => {
  const data = tmp(), port = String(20000 + Math.floor(Math.random() * 20000)), base = `http://127.0.0.1:${port}`;
  const call = async (p, method = "GET", body, token) => { const r = await fetch(base + p, { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  const server = await startServer({ PORT: port, GBQ_DATA: data });
  const streams = [];
  try {
    const reg = async name => { const r = await call("/api/register", "POST", { username: name, password: "world-password-1" }); assert.equal(r.status, 201); return r.body.token; };
    const ta = await reg("alpha" + port), tb = await reg("bravo" + port);
    // pick different realms
    assert.equal((await call("/api/realm/select", "POST", { realm: "moonfall" }, ta)).status, 200);
    assert.equal((await call("/api/realm/select", "POST", { realm: "emberwild" }, tb)).status, 200);
    assert.equal((await call("/api/realm/select", "POST", { realm: "atlantis" }, ta)).status, 400);
    assert.equal((await call("/api/me", "GET", null, ta)).body.account?.realm ?? "moonfall", "moonfall");
    const A = await stream(base, ta); streams.push(A); assert.equal(A.realm, "moonfall");
    const B = await stream(base, tb); streams.push(B); assert.equal(B.realm, "emberwild");
    // A's player list never contains B
    await new Promise(r => setTimeout(r, 300));
    const lastPeers = s => [...s.events].reverse().find(e => e.event === "peers")?.data.peers || [];
    assert.ok(!lastPeers(A).some(p => p.peer === B.peer), "different realms do not see each other");
    // realm populations are live
    let realms = (await call("/api/realms")).body.realms;
    assert.equal(realms.find(r => r.id === "moonfall").population, 1);
    assert.equal(realms.find(r => r.id === "emberwild").population, 1);
    assert.ok(realms.every(r => r.load));
    // world chat and battle topics stay on the realm
    assert.equal((await call("/api/emit", "POST", { peer: A.peer, topic: "chat", data: { channel: "world", text: "hello moonfall" } }, ta)).status, 200);
    assert.equal((await call("/api/emit", "POST", { peer: A.peer, topic: "srv_join", data: { x: 1 } }, ta)).status, 200);
    await new Promise(r => setTimeout(r, 300));
    assert.ok(!B.events.some(e => e.event === "msg"), "no cross-realm messages");
    assert.equal((await call("/api/emit", "POST", { peer: A.peer, topic: "chat", data: { channel: "whisper", to: B.peer, text: "psst" } }, ta)).status, 404);
    // B moves to moonfall: its live connection follows, now they see each other and chat arrives
    const sel = await call("/api/realm/select", "POST", { realm: "moonfall" }, tb); assert.equal(sel.status, 200); assert.equal(sel.body.population, 2);
    await A.waitFor("peers", d => d.peers.some(p => p.peer === B.peer));
    await B.waitFor("peers", d => d.peers.some(p => p.peer === A.peer));
    await new Promise(r => setTimeout(r, 1100));
    assert.equal((await call("/api/emit", "POST", { peer: A.peer, topic: "chat", data: { channel: "world", text: "welcome" } }, ta)).status, 200);
    const msg = await B.waitFor("msg", d => d.data && d.data.text === "welcome"); assert.equal(msg.topic, "chat");
    realms = (await call("/api/realms")).body.realms;
    assert.equal(realms.find(r => r.id === "moonfall").population, 2);
    assert.equal(realms.find(r => r.id === "emberwild").population, 0);
    // cloud saves remember their hero's realm; signed-in realm lists count your characters per realm
    assert.equal((await call("/api/saves/0", "PUT", { state: { name: "Ann", cls: "warden", lvl: 3, realm: "emberwild" } }, ta)).status, 200);
    assert.equal((await call("/api/saves/1", "PUT", { state: { name: "Ann2", cls: "warden", lvl: 1 } }, ta)).status, 200);
    assert.equal((await call("/api/saves", "GET", null, ta)).body.slots[0].realm, "emberwild");
    const mine = (await call("/api/realms", "GET", null, ta)).body.realms;
    assert.equal(mine.find(r => r.id === "emberwild").characters, 1);
    assert.equal(mine.find(r => r.id === "moonfall").characters, 1); // no realm in the save: the account's realm
    assert.equal(realms.find(r => r.id === "moonfall").characters, undefined); // not signed in: no counts
    const regions = (await call("/api/regions")).body.regions;
    assert.ok(regions.every(g => Array.isArray(g.realms) && g.realms.length === g.worlds));
  } finally {
    for (const s of streams) s.close();
    await stop(server);
  }
});
