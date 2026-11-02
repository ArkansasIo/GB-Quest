import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { existsSync, readFile } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.dirname(fileURLToPath(import.meta.url));
const maxBodyBytes = 4096;
const integerRanges = {
  naturalRoll: [1, 20],
  abilityScore: [1, 30],
  proficiency: [0, 6],
  bonus: [-50, 50],
  targetArmorClass: [0, 100],
};

export function validateAttackRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new TypeError("Expected a JSON object");
  }
  for (const [field, [min, max]] of Object.entries(integerRanges)) {
    if (!Number.isInteger(body[field]) || body[field] < min || body[field] > max) {
      throw new RangeError(`${field} must be an integer from ${min} to ${max}`);
    }
  }
  return body;
}

function nativeExecutable() {
  if (process.env.GBQUEST_NATIVE_CLI) return process.env.GBQUEST_NATIVE_CLI;
  const candidates = [
    "build/native/Release/gbquest_native_cli.exe",
    "build/native/gbquest_native_cli.exe",
    "build/native/gbquest_native_cli",
    "build/native/Release/gbquest_native_cli",
  ];
  return candidates.map(file => path.join(root, file)).find(existsSync);
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxBodyBytes) throw new RangeError("Request body is too large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new TypeError("Request body must be valid JSON");
  }
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function staticFile(requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  const relative = decoded === "/" ? "index.html" : decoded.slice(1);
  if (!relative || relative.split(/[\\/]/).some(part => part.startsWith("."))) return null;
  const file = path.resolve(root, relative);
  const allowedRoots = ["src", "assets", "dist", "legacy"].map(dir => path.join(root, dir) + path.sep);
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
    default: return "application/octet-stream";
  }
}

export function createGameServer() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/api/native/attack") {
      if (request.method !== "POST") {
        response.setHeader("Allow", "POST");
        sendJson(response, 405, { error: "method_not_allowed" });
        return;
      }
      const origin = request.headers.origin;
      if (origin) {
        let parsedOrigin;
        try {
          parsedOrigin = new URL(origin);
        } catch {
          sendJson(response, 403, { error: "origin_not_allowed" });
          return;
        }
        const address = server.address();
        const localHost = parsedOrigin.protocol === "http:"
          && ["127.0.0.1", "localhost"].includes(parsedOrigin.hostname);
        const originPort = Number(parsedOrigin.port || 80);
        if (!localHost || !address || originPort !== address.port) {
          sendJson(response, 403, { error: "origin_not_allowed" });
          return;
        }
      }
      const executable = nativeExecutable();
      if (!executable) {
        sendJson(response, 503, { error: "native_core_not_built", command: "npm run native:build" });
        return;
      }
      try {
        const body = validateAttackRequest(await readJson(request));
        const args = [
          "resolve-attack",
          body.naturalRoll,
          body.abilityScore,
          body.proficiency,
          body.bonus,
          body.targetArmorClass,
        ].map(String);
        const { stdout } = await execFileAsync(executable, args, {
          cwd: root,
          timeout: 5000,
          windowsHide: true,
          maxBuffer: 4096,
        });
        sendJson(response, 200, JSON.parse(stdout));
      } catch (error) {
        if (error instanceof TypeError || error instanceof RangeError) {
          sendJson(response, 400, { error: error.message });
          return;
        }
        console.error("Native rules request failed:", error.message);
        sendJson(response, 500, { error: "native_core_failed" });
      }
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      response.writeHead(405).end();
      return;
    }
    const file = staticFile(url.pathname);
    if (!file) {
      response.writeHead(404).end();
      return;
    }
    readFile(file, (error, contents) => {
      if (error) {
        response.writeHead(error.code === "ENOENT" ? 404 : 500).end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": contentType(file),
        "X-Content-Type-Options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : contents);
    });
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("PORT must be an integer from 1 to 65535");
    process.exitCode = 1;
  } else {
    const server = createGameServer();
    server.listen(port, "127.0.0.1", () => {
      console.log(`GB Quest running at http://127.0.0.1:${port}`);
      if (!nativeExecutable()) console.log("Native core is not built; run npm run native:build.");
    });
  }
}
