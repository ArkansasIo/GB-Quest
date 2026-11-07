import { createServer } from "node:http";
import { existsSync, readFile } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

function staticFile(requestPath) {
  let decoded;
  try { decoded = decodeURIComponent(requestPath); } catch { return null; }
  const relative = decoded === "/" ? "index.html" : decoded.slice(1);
  if (!relative || relative.split(/[\\/]/).some(part => part.startsWith("."))) return null;
  const file = path.resolve(root, relative);
  const allowedRoots = ["src", "client", "assets", "assets_hd64", "assets_citadel", "dist", "legacy"].map(dir => path.join(root, dir) + path.sep);
  if (file !== path.join(root, "index.html") && !allowedRoots.some(dir => file.startsWith(dir))) return null;
  return file;
}

function contentType(file) {
  switch (path.extname(file).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".png": return "image/png";
    case ".svg": return "image/svg+xml";
    default: return "application/octet-stream";
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname === "/api/health") {
    response.writeHead(200, {"Content-Type": "application/json"});
    response.end(JSON.stringify({ ok: true, service: "game-static-server", fixes: ["chat-padding", "pixel-nearest"] }));
    return;
  }
  const file = staticFile(url.pathname);
  if (!file) { response.writeHead(404).end(); return; }
  readFile(file, (error, contents) => {
    if (error) { response.writeHead(error.code === "ENOENT" ? 404 : 500).end(); return; }
    response.writeHead(200, {"Content-Type": contentType(file)});
    response.end(contents);
  });
});

const port = Number(process.env.PORT || 8000);
server.listen(port, "127.0.0.1", () => {
  console.log(`GB-Quest (with pixel + chat fixes) running at http://127.0.0.1:${port}`);
});
