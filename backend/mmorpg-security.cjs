'use strict';

function isAllowedOrigin(origin, allowlist = new Set()) {
  if (!origin) return true; // Native/server clients do not send Origin.
  try {
    const url = new URL(origin);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return local || (url.protocol === 'https:' && allowlist.has(url.origin));
  } catch {
    return false;
  }
}

function createCorsHeaders(origin, allowlist = new Set()) {
  const headers = { vary: 'Origin' };
  if (!origin) return headers;
  if (!isAllowedOrigin(origin, allowlist)) return null;
  headers['access-control-allow-origin'] = origin;
  headers['access-control-allow-methods'] = 'GET, POST, DELETE, OPTIONS';
  headers['access-control-allow-headers'] = 'authorization, content-type';
  headers['access-control-max-age'] = '600';
  return headers;
}

function createAuthLimiter({ limit = 10, windowMs = 600000, clock = Date.now } = {}) {
  const failures = new Map();
  function current(ip) {
    const entry = failures.get(ip);
    if (!entry || clock() - entry.startedAt >= windowMs) {
      failures.delete(ip);
      return null;
    }
    return entry;
  }
  return {
    blocked(ip) {
      const entry = current(ip);
      return !!entry && entry.count >= limit;
    },
    fail(ip) {
      const entry = current(ip);
      if (!entry) failures.set(ip, { count: 1, startedAt: clock() });
      else entry.count++;
    },
    clear(ip) { failures.delete(ip); },
    sweep() {
      for (const [ip, entry] of failures) {
        if (clock() - entry.startedAt >= windowMs) failures.delete(ip);
      }
    }
  };
}

module.exports = { isAllowedOrigin, createCorsHeaders, createAuthLimiter };
