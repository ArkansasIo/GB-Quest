import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// Source-text assertions can pass while a script no longer parses (an over-escaped regex broke tools/build-itch.cjs
// this way). Every Node script in tools/ and backend/ must at least compile.
const scripts = ['tools', 'backend'].flatMap(d => fs.readdirSync(d).filter(f => /\.(cjs|mjs|js)$/.test(f)).map(f => `${d}/${f}`));

test('every Node script in tools/ and backend/ parses', () => {
  assert.ok(scripts.includes('tools/build-itch.cjs') && scripts.includes('tools/build.cjs'));
  const bad = [];
  for (const f of scripts) {
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (e) { bad.push(`${f}: ${String(e.stderr || e).split('\n').find(l => /Error/.test(l)) || 'does not parse'}`); }
  }
  assert.deepEqual(bad, []);
});
