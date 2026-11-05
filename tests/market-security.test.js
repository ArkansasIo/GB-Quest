import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "gbq-market-gate-"));

function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["backend/server.cjs"], {
      env: { ...process.env, HOST: "127.0.0.1", GBQ_ROOT_ID: "", GBQ_ADMIN_ID: "", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("server startup timeout: " + output)); }, 8000);
    child.stdout.on("data", chunk => {
      output += chunk;
      if (output.includes("realm server on")) { clearTimeout(timer); resolve(child); }
    });
    child.stderr.on("data", chunk => { output += chunk; });
    child.on("exit", code => { clearTimeout(timer); reject(new Error(`server exited ${code}: ${output}`)); });
  });
}

const stop = child => new Promise(resolve => {
  child.removeAllListeners("exit");
  child.once("exit", resolve);
  child.kill("SIGTERM");
});

test("realm market endpoints fail closed until unsafe legacy economy is explicitly enabled", async () => {
  const data = temp();
  const port = String(21000 + Math.floor(Math.random() * 18000));
  const base = `http://127.0.0.1:${port}`;
  const call = async (route, { method = "GET", body, token } = {}) => {
    const response = await fetch(base + route, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  };
  const server = await startServer({ PORT: port, GBQ_DATA: data });
  try {
    const registered = await call("/api/register", { method: "POST", body: { username: "marketuser", password: "market-pass-1" } });
    assert.equal(registered.status, 201);
    const token = registered.body.token;

    for (const [route, method, body] of [
      ["/api/market", "GET", undefined],
      ["/api/market", "POST", { item: { kind: "weapon", base: "forged" }, price: 1 }],
      ["/api/market/buy", "POST", { id: "missing" }],
      ["/api/market/cancel", "POST", { id: "missing" }],
      ["/api/market/claim", "GET", undefined],
    ]) {
      const result = await call(route, { method, body, token });
      assert.equal(result.status, 503, `${method} ${route} must fail closed`);
      assert.match(result.body.error, /ownership and wallet settlement are not implemented/);
    }
  } finally {
    await stop(server);
    fs.rmSync(data, { recursive: true, force: true });
  }
});

test("realm direct-trade relay fails closed while ordinary multiplayer topics remain enabled", async () => {
  const data = temp();
  const port = String(21000 + Math.floor(Math.random() * 18000));
  const base = `http://127.0.0.1:${port}`;
  const server = await startServer({ PORT: port, GBQ_DATA: data });
  let stream;
  try {
    const registered = await fetch(base + "/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "tradeuser", password: "trade-pass-1" }),
    }).then(r => r.json());
    stream = await fetch(base + "/api/stream", { headers: { Authorization: `Bearer ${registered.token}` } });
    assert.equal(stream.status, 200);
    const reader = stream.body.getReader();
    let buffer = "";
    let peer = "";
    for (let i = 0; i < 8 && !peer; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += new TextDecoder().decode(value);
      const match = buffer.match(/event: hello\ndata: (.+)\n/);
      if (match) peer = JSON.parse(match[1]).peer;
    }
    assert.ok(peer, "realm stream must provide a peer id");
    const emit = async topic => fetch(base + "/api/emit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${registered.token}` },
      body: JSON.stringify({ peer, topic, data: {} }),
    });
    assert.equal((await emit("trade")).status, 503);
    assert.equal((await emit("srv_act")).status, 200);
    await reader.cancel();
  } finally {
    if (stream?.body) await stream.body.cancel().catch(() => {});
    await stop(server);
    fs.rmSync(data, { recursive: true, force: true });
  }
});
