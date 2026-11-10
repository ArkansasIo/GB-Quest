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

test('character roster merges device and cloud slots per realm', () => {
  const A = load();
  const locals = [
    { name: 'Ann', lvl: 5, cls: 'warden', realm: 'moonfall', saved: 200, map: 'town' },
    { name: 'Bo', lvl: 2, cls: 'shade', saved: 100 },             // no realm: falls back to the account realm
    null,
    { name: 'Cy', lvl: 9, cls: 'cantor', realm: 'emberwild', saved: 50 },
    null,
  ];
  const clouds = [
    { name: 'Ann', lvl: 6, cls: 'warden', realm: 'moonfall', saved: 300 }, // same hero, cloud newer
    null,
    { name: 'Dee', lvl: 1, cls: 'arcanist', realm: 'moonfall', saved: 10 }, // cloud only
    { name: 'Eve', lvl: 4, cls: 'strider', realm: 'emberwild', saved: 90 }, // different hero, cloud newer
    null,
  ];
  const r = A.mergeRoster(locals, clouds, 'moonfall');
  assert.equal(r[0].where, 'BOTH'); assert.equal(r[0].newer, 'cloud'); assert.equal(r[0].lvl, 6); assert.equal(r[0].zone, 'town');
  assert.equal(r[1].where, 'LOCAL'); assert.equal(r[1].realm, 'moonfall');
  assert.equal(r[2].where, 'CLOUD'); assert.equal(r[2].slot, 2);
  assert.equal(r[3].where, 'CLOUD'); assert.equal(r[3].name, 'Eve'); assert.equal(r[3].hidden, 'Cy');
  assert.equal(r[4], null);
  assert.equal(A.rosterOn(r, 'moonfall').map(h => h.name).join(','), 'Ann,Bo,Dee');
  assert.equal(JSON.stringify(A.otherRealmCounts(r, 'moonfall')), JSON.stringify({ emberwild: 1 }));
  assert.equal(A.freeSlot(locals, clouds, 5), 4);
  assert.equal(A.freeSlot([1, 1], [null, null, 1], 3), -1);
  assert.equal(A.mergeRoster([], [], 'x').length, 0);
});

test('friends helpers: sort, last seen text, actions', () => {
  const A = load();
  const list = [{ name: 'zed', online: false, realm: 'moonfall' }, { name: 'amy', online: true, realm: 'emberwild' }, { name: 'bob', online: true, realm: 'moonfall' }, { name: 'cat', online: false, realm: 'emberwild' }];
  assert.equal(A.sortFriends(list, 'moonfall').map(f => f.name).join(','), 'bob,amy,zed,cat');
  const now = 1e12;
  assert.equal(A.agoText(null, now), '-'); assert.equal(A.agoText(now - 30e3, now), 'NOW'); assert.equal(A.agoText(now - 5 * 60e3, now), '5M AGO');
  assert.equal(A.agoText(now - 3 * 3600e3, now), '3H AGO'); assert.equal(A.agoText(now - 72 * 3600e3, now), '3D AGO');
  assert.equal(A.friendActions({ online: true, realm: 'moonfall' }, 'moonfall').join(','), 'WHISPER,REMOVE FRIEND');
  assert.equal(A.friendActions({ online: true, realm: 'emberwild' }, 'moonfall').join(','), 'REMOVE FRIEND');
  assert.equal(A.friendActions({ online: false, realm: 'moonfall' }, 'moonfall').join(','), 'REMOVE FRIEND');
});
