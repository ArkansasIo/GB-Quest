import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The browser runs every <script> in index.html in one shared global scope. A top-level `const`/`let`/`class`
// whose name is already declared by another script (for example `function hashStr` in gen.js) makes the later
// script fail with "Identifier ... has already been declared", and none of it runs. Per-file vm tests cannot
// see this, so compare the top-level (column 0) declarations of every page script that is not wrapped in its
// own scope (`(() => { ... })();`, the convention for modules).
test('no page script redeclares a top-level name with const, let or class', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const files = [...html.matchAll(/<script src="((?:src|client)\/[^"]+\.js)"/g)].map(m => m[1]);
  assert.ok(files.length > 50, `found ${files.length} scripts`);
  const seen = new Map(), clashes = [];
  for (const f of files) {
    const code = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    const first = code.split('\n').find(l => l.trim() && !/^\s*(\/\/|'use strict')/.test(l)) || '';
    if (/^\(\(\) => \{|^\(function\b/.test(first)) continue;
    for (const m of code.matchAll(/^(const|let|class|function|var)\s+([A-Za-z_$][\w$]*)/gm)) {
      const [, kind, name] = m, lexical = kind === 'const' || kind === 'let' || kind === 'class';
      const prev = seen.get(name);
      if (prev && prev.file !== f && (lexical || prev.lexical)) clashes.push(`${name}: ${prev.kind} in ${prev.file}, ${kind} in ${f}`);
      if (!prev) seen.set(name, { file: f, kind, lexical });
    }
  }
  assert.deepEqual(clashes, []);
});
