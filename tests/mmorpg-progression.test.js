import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(new URL('../backend/migrations/009_jobs_level_720.sql', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../backend/mmorpg-server.cjs', import.meta.url), 'utf8');
const expectedJobs = [
  'warden','berserker','vanguard','strider','shade','ascetic','arcanist','wildblood',
  'pactbound','cantor','chaplain','verdant','necromancer','summoner','sunwarden','runeblade',
  'ronin','shinobi','bladedancer','wyrmlancer','corsair','beastcaller','puppeteer',
  'dreadknight','voidhunter','scalesage','stormcaller'
];

test('PostgreSQL migration and HTTP creation share all 27 browser-game jobs', () => {
  const migrationJobs = [...migration.matchAll(/'([a-z]+)'/g)].map(match => match[1]).filter(id => expectedJobs.includes(id));
  const serverJobs = [...server.matchAll(/'([a-z]+)'/g)].map(match => match[1]).filter(id => expectedJobs.includes(id));
  assert.deepEqual([...new Set(migrationJobs)].sort(), [...expectedJobs].sort());
  assert.deepEqual([...new Set(serverJobs)].sort(), [...expectedJobs].sort());
});

test('progression migration supports level 720 and the shared XP function', () => {
  assert.match(migration, /CHECK \(level BETWEEN 1 AND 720\)/);
  assert.match(migration, /CHECK \(level_required BETWEEN 1 AND 720\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION gbq_level_for_xp/);
  assert.match(migration, /355000/);
  assert.match(migration, /720/);
});

test('legacy class IDs are mapped before the new database constraint is applied', () => {
  for (const [legacy, current] of [
    ['warrior','warden'],['mage','arcanist'],['ranger','strider'],
    ['cleric','chaplain'],['rogue','shade'],['adventurer','warden']
  ]) {
    assert.match(migration, new RegExp(`WHEN '${legacy}' THEN '${current}'`));
  }
});
