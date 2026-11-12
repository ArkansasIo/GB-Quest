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

function createRequestLimiter({ limit = 90, windowMs = 60000, maxKeys = 10000, clock = Date.now } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1 ||
      !Number.isSafeInteger(maxKeys) || maxKeys < 1) throw new TypeError('invalid_request_limiter_config');
  const buckets = new Map();
  function prune(now) {
    for (const [key, entry] of buckets) {
      if (now - entry.startedAt >= windowMs) buckets.delete(key);
    }
    while (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value);
  }
  return {
    consume(key) {
      const now = clock();
      let entry = buckets.get(key);
      if (!entry || now - entry.startedAt >= windowMs) {
        if (!entry) prune(now);
        entry = { count: 0, startedAt: now };
        buckets.set(key, entry);
      }
      entry.count++;
      const retryAfter = Math.max(1, Math.ceil((entry.startedAt + windowMs - now) / 1000));
      return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count), retryAfter };
    },
    sweep() {
      const now = clock();
      for (const [key, entry] of buckets) {
        if (now - entry.startedAt >= windowMs) buckets.delete(key);
      }
    },
    size() { return buckets.size; }
  };
}

const corsHeaders = createCorsHeaders; // compatibility alias for the legacy HTTP server.\nmodule.exports = { isAllowedOrigin, createCorsHeaders, corsHeaders, createAuthLimiter, createRequestLimiter };
