import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isAllowedOrigin, createCorsHeaders, createAuthLimiter, createRequestLimiter } = require('../backend/mmorpg-security.cjs');

test('browser origins require an exact HTTPS allowlist match', () => {
  const allow = new Set(['https://game.example.test', 'https://publisher.example.test']);
  assert.equal(isAllowedOrigin(undefined, allow), true, 'native clients may omit Origin');
  assert.equal(isAllowedOrigin('http://localhost:8080', allow), true, 'local development is allowed');
  assert.equal(isAllowedOrigin('https://game.example.test', allow), true);
  assert.equal(isAllowedOrigin('https://game.example.test.attacker.invalid', allow), false);
  assert.equal(isAllowedOrigin('https://attacker.invalid', allow), false);
  assert.equal(isAllowedOrigin('http://game.example.test', allow), false);
  assert.equal(isAllowedOrigin('not a URL', allow), false);
  assert.equal(isAllowedOrigin('https://game.example.test', new Set()), false, 'empty production allowlist fails closed');
});

test('authentication limiter blocks after threshold and resets after the window', () => {
  let time = 1000;
  const limiter = createAuthLimiter({ limit: 3, windowMs: 10000, clock: () => time });
  assert.equal(limiter.blocked('192.0.2.10'), false);
  limiter.fail('192.0.2.10');
  limiter.fail('192.0.2.10');
  assert.equal(limiter.blocked('192.0.2.10'), false);
  limiter.fail('192.0.2.10');
  assert.equal(limiter.blocked('192.0.2.10'), true);
  limiter.clear('192.0.2.10');
  assert.equal(limiter.blocked('192.0.2.10'), false);
  limiter.fail('192.0.2.10');
  time += 10001;
  assert.equal(limiter.blocked('192.0.2.10'), false);
  limiter.fail('192.0.2.11');
  limiter.sweep();
  assert.equal(limiter.blocked('192.0.2.11'), false);
});

test('authentication limiter tracks client IPs independently', () => {
  const limiter = createAuthLimiter({ limit: 2 });
  limiter.fail('192.0.2.1');
  limiter.fail('192.0.2.1');
  assert.equal(limiter.blocked('192.0.2.1'), true);
  assert.equal(limiter.blocked('192.0.2.2'), false);
});

test('CORS headers are emitted only for allowed origins and expose the API methods', () => {
  const allow = new Set(['https://game.example.test']);
  assert.deepEqual(createCorsHeaders(undefined, allow), { vary: 'Origin' });
  assert.deepEqual(createCorsHeaders('https://game.example.test', allow), {
    vary: 'Origin',
    'access-control-allow-origin': 'https://game.example.test',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '600'
  });
  assert.equal(createCorsHeaders('https://attacker.invalid', allow), null);
});

test('request limiter enforces a fixed window and reports retry time', () => {
  let time = 5000;
  const limiter = createRequestLimiter({ limit: 2, windowMs: 10000, clock: () => time });
  assert.deepEqual(limiter.consume('ip:write'), { allowed: true, remaining: 1, retryAfter: 10 });
  assert.deepEqual(limiter.consume('ip:write'), { allowed: true, remaining: 0, retryAfter: 10 });
  assert.deepEqual(limiter.consume('ip:write'), { allowed: false, remaining: 0, retryAfter: 10 });
  time += 2500;
  assert.deepEqual(limiter.consume('ip:write'), { allowed: false, remaining: 0, retryAfter: 8 });
  assert.deepEqual(limiter.consume('other-ip:write'), { allowed: true, remaining: 1, retryAfter: 10 });
  time += 7500;
  assert.deepEqual(limiter.consume('ip:write'), { allowed: true, remaining: 1, retryAfter: 10 });
});

test('request limiter bounds key storage and rejects invalid configuration', () => {
  let time = 0;
  const limiter = createRequestLimiter({ limit: 1, windowMs: 100, maxKeys: 2, clock: () => time });
  limiter.consume('one');
  limiter.consume('two');
  limiter.consume('three');
  assert.equal(limiter.size(), 2);
  assert.throws(() => createRequestLimiter({ limit: 0 }), /invalid_request_limiter_config/);
  time = 101;
  limiter.sweep();
  assert.equal(limiter.size(), 0);
});
