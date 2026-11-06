import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('development HTML wrapper uses the shell as the single source of head metadata', () => {
  const build = read('tools/build.cjs');
  const shell = read('client/shell.html');
  const devStart = build.indexOf('const dev = ');
  const devEnd = build.indexOf('\nfs.writeFileSync(path.join(ROOT, \'index.html\')', devStart);
  assert.ok(devStart >= 0 && devEnd > devStart, 'development HTML template must exist');
  const devTemplate = build.slice(devStart, devEnd);
  assert.doesNotMatch(devTemplate, /<meta charset=/i);
  assert.doesNotMatch(devTemplate, /<meta name="viewport"/i);
  assert.match(shell, /<meta charset="utf-8">/i);
  assert.match(shell, /<meta name="viewport"/i);
});

test('itch.io HD64 JSON is escaped before insertion into an inline script', () => {
  const build = read('tools/build-itch.cjs');
  assert.match(build, /const packedJson = JSON\.stringify\(hd64Pack\)/);
  assert.match(build, /\.replace\(\/</);
  assert.match(build, /\.replace\(\/>/);
  assert.match(build, /\.replace\(\/&/);
  assert.match(build, /packedJson \+ ';<\\/script>/);
  assert.doesNotMatch(build, /JSON\.stringify\(hd64Pack\) \+ ';<\\/script>\\\\n'/);
});
