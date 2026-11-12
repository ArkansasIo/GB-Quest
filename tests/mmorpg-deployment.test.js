import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const compose = fs.readFileSync(new URL('../docker-compose.mmorpg.yml', import.meta.url), 'utf8');
const envExample = fs.readFileSync(new URL('../.env.mmorpg.example', import.meta.url), 'utf8');

test('MMO host port binds to loopback by default and remains configurable', () => {
  assert.match(compose, /\$\{GBQ_BIND_ADDRESS:-127\.0\.0\.1\}:\$\{GBQ_PORT:-8788\}:8788/);
  assert.match(compose, /HOST: 0\.0\.0\.0/);
});

test('MMO environment example documents the browser origin allowlist', () => {
  assert.match(envExample, /GBQ_ALLOWED_ORIGINS=/);
  assert.match(envExample, /deny remote browser origins/);
  assert.match(envExample, /https:\/\/yourname\.itch\.io/);
});
