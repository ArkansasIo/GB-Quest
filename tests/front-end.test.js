import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/front_end.js', import.meta.url), 'utf8');
function load() { const c = { Math, Number, String, Object, Array, RegExp, globalThis: null }; c.globalThis = c; vm.runInNewContext(source, c); return c.GBQFrontEnd; }

test('credential checks match the realm server rules', () => {
  const A = load();
  assert.equal(A.checkCredentials('ab', 'password1'), 'Name: 3-16 letters, digits or _.');
  assert.equal(A.checkCredentials('bad name', 'password1'), 'Name: 3-16 letters, digits or _.');
  assert.equal(A.checkCredentials('hero_1', 'short'), 'Password: 8-72 characters.');
  assert.equal(A.checkCredentials('hero_1', 'x'.repeat(73)), 'Password: 8-72 characters.');
  assert.equal(A.checkCredentials('hero_1', 'password1', 'password2', true), 'Passwords do not match.');
  assert.equal(A.checkCredentials('hero_1', 'password1', 'password1', true), null);
  assert.equal(A.checkCredentials('hero_1', 'password1', 'whatever', false), null);
});

test('password strength', () => {
  const A = load();
  assert.equal(A.passwordStrength(''), '');
  assert.equal(A.passwordStrength('aaaaaaaa'), 'WEAK');
  assert.equal(A.passwordStrength('Aaaaaaaa1'), 'FAIR');
  assert.equal(A.passwordStrength('Correct-Horse-9-Battery'), 'STRONG');
});

test('suggested realm: online, not full, fewest players, PvE on ties', () => {
  const A = load();
  const R = [
    { id: 'a', type: 'PvP', status: 'online', population: 0, maxPlayers: 1000 },
    { id: 'b', type: 'PvE', status: 'online', population: 0, maxPlayers: 1000 },
    { id: 'c', type: 'PvE', status: 'offline', population: 0, maxPlayers: 1000 },
    { id: 'd', type: 'PvE', status: 'online', population: 1000, maxPlayers: 1000 },
  ];
  assert.equal(A.suggestRealm(R).id, 'b');
  assert.equal(A.suggestRealm([R[2], R[3]]), null);
  assert.equal(A.loadOf({ status: 'online', population: 10, maxPlayers: 1000 }), 'LOW');
  assert.equal(A.loadOf({ status: 'online', population: 400, maxPlayers: 1000 }), 'MEDIUM');
  assert.equal(A.loadOf({ status: 'online', population: 800, maxPlayers: 1000 }), 'HIGH');
  assert.equal(A.loadOf({ status: 'online', population: 1000, maxPlayers: 1000 }), 'FULL');
  assert.equal(A.loadOf({ status: 'offline' }), 'OFFLINE');
  for (const t of ['PvE', 'PvP', 'Roleplay', 'Seasonal']) assert.ok(A.TYPE_RULES[t].length >= 3);
});
