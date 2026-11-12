import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isAllowedOrigin, corsHeaders, createAuthLimiter } = require('../backend/mmorpg-security.cjs');

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

test('CORS preflight headers are returned only for an exact allowed origin', () => {
  const allow = new Set(['https://game.example.test']);
  assert.deepEqual(corsHeaders(undefined, allow), {});
  assert.equal(corsHeaders('https://attacker.invalid', allow), null);
  assert.deepEqual(corsHeaders('https://game.example.test', allow), {
    'access-control-allow-origin': 'https://game.example.test',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '600',
    vary: 'Origin'
  });
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
