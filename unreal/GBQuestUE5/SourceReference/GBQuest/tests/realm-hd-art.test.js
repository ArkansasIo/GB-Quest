import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";

// The realm server serves the game page without the embedded HD64 pack (it would push dist/ past GitHub's 100 MB
// limit), so it serves the HD art files themselves: only those folders, only PNG and JSON.
function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["backend/server.cjs"], { env: { ...process.env, HOST: "127.0.0.1", GBQ_ROOT_ID: "", GBQ_ADMIN_ID: "", ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; const timer = setTimeout(() => { child.kill(); reject(new Error("no start: " + out)); }, 8000);
    child.stdout.on("data", d => { out += d; if (out.includes("realm server on")) { clearTimeout(timer); resolve(child); } });
    child.stderr.on("data", d => { out += d; });
  });
}
const stop = child => new Promise(r => { child.on("exit", r); child.kill("SIGTERM"); });
// a raw request, so "../" reaches the server exactly as written
const raw = (port, p) => new Promise((resolve, reject) => {
  const s = net.connect(+port, "127.0.0.1", () => s.end(`GET ${p} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`));
  let buf = ""; s.on("data", d => { buf += d.toString("latin1"); }); s.on("end", () => resolve(+buf.slice(9, 12))); s.on("error", reject);
});
const frame = (() => { const root = "assets_hd64/animations/frames"; if (!fs.existsSync(root)) return null;
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) { const r = walk(f); if (r) return r; } else if (f.endsWith(".png")) return f; } return null; };
  return walk(root); })();

test("the realm server serves the HD art the game asks for, and nothing else", { skip: frame ? false : "HD64 frames not generated" }, async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "gbq-hd-")), port = String(41000 + Math.floor(Math.random() * 8000)); // its own range: other server tests use 20000-40000
  const server = await startServer({ PORT: port, GBQ_DATA: data });
  try {
    const get = async p => { const r = await fetch(`http://127.0.0.1:${port}${p}`); return { status: r.status, type: r.headers.get("content-type") || "" }; };
    const manifest = await get("/assets_hd64/equipment/equipment_manifest.json");
    assert.equal(manifest.status, 200); assert.match(manifest.type, /application\/json/);
    assert.equal((await get("/data/visuals/equipment-catalog-visual-map.json")).status, 200);
    const png = await get("/" + frame.split(path.sep).join("/"));
    assert.equal(png.status, 200); assert.equal(png.type, "image/png");
    for (const p of ["/assets_hd64/equipment/../../backend/server.cjs", "/assets_hd64/equipment/%2e%2e/%2e%2e/package.json",
      "/assets_hd64/equipment/..%5c..%5cpackage.json", "/assets_hd64/equipment/x.txt", "/data/visuals/other.json", "/backend/server.cjs", "/assets_hd64/../package.json"])
      assert.equal(await raw(port, p), 404, p);
  } finally { await stop(server); }
});

test("a missing HD file is retried after a minute, not on every frame", () => {
  const src = fs.readFileSync("src/hd_character_art.js", "utf8");
  for (const p of ["visualMapPromise", "manifestPromise"]) assert.ok(src.includes(`pending.catch(() => setTimeout(() => { if (${p} === pending) ${p} = null; }, 60000))`), p);
});
