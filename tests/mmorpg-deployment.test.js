import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const compose = fs.readFileSync(new URL('../docker-compose.mmorpg.yml', import.meta.url), 'utf8');
const envExample = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const dockerfile = fs.readFileSync(new URL('../Dockerfile.mmorpg', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../.github/workflows/mmorpg-container.yml', import.meta.url), 'utf8');
const runbook = fs.readFileSync(new URL('../ops/mmorpg-server/README.md', import.meta.url), 'utf8');

test('MMO host port binds to loopback by default and remains configurable', () => {
  assert.match(compose, /\$\{MMO_BIND_ADDRESS:-127\.0\.0\.1\}:\$\{MMO_PORT:-8788\}:8788/);
  assert.match(compose, /HOST: 0\.0\.0\.0/);
});

test('database starts before ordered migrations and MMO service', () => {
  assert.match(compose, /POSTGRES_PASSWORD:\s*\$\{POSTGRES_PASSWORD:\?Set POSTGRES_PASSWORD in \.env\}/);
  assert.match(compose, /pg_isready -U \$\$\{POSTGRES_USER\} -d \$\$\{POSTGRES_DB\}/);
  assert.match(compose, /migrate:[\s\S]*?condition: service_healthy/);
  assert.match(compose, /command: \["node", "backend\/migrate\.cjs"\]/);
  assert.match(compose, /mmo:[\s\S]*?condition: service_completed_successfully/);
  assert.match(compose, /gbquest_pg_data:/);
});

test('environment example documents independent secrets and exact browser origins', () => {
  assert.match(envExample, /POSTGRES_PASSWORD=REPLACE_WITH_LONG_RANDOM_HEX_VALUE/);
  assert.match(envExample, /GBQ_TOKEN_SECRET=REPLACE_WITH_AT_LEAST_64_RANDOM_HEX_CHARACTERS/);
  assert.match(envExample, /GBQ_ALLOWED_ORIGINS=/);
  assert.match(envExample, /MMO_BIND_ADDRESS=127\.0\.0\.1/);
});

test('container runs the dedicated PostgreSQL/WebSocket server as an unprivileged user', () => {
  assert.match(dockerfile, /FROM node:22-bookworm-slim/);
  assert.match(dockerfile, /npm install --omit=dev/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /backend\/mmorpg-server\.cjs/);
  assert.match(dockerfile, /127\.0\.0\.1:8788\/health/);
});

test('CI validates deployment unit tests, Compose interpolation and image build', () => {
  assert.match(workflow, /node --test tests\/mmorpg-deployment\.test\.js tests\/mmorpg-server-security\.test\.js tests\/mmorpg-socket-queue\.test\.js/);
  assert.match(workflow, /docker compose --env-file \.env\.ci -f docker-compose\.mmorpg\.yml config --quiet/);
  assert.match(workflow, /docker build --file Dockerfile\.mmorpg/);
});

test('runbook documents TLS proxying, backups and single-instance limits', () => {
  assert.match(runbook, /TLS|HTTPS/i);
  assert.match(runbook, /backup/i);
  assert.match(runbook, /single-instance|single instance/i);
});
