#!/usr/bin/env node
// Syntax-check every tracked JavaScript file (repository audit 2026-11-11, P2), so new modules can't be missed the
// way a hand-maintained list can miss them. Nothing is executed:
//   *.cjs                         CommonJS: compiled inside the CommonJS module wrapper
//   *.mjs, and *.js using import/export (this package is "type": "module")
//                                 ES modules: `node --check` in a child process
//   other *.js                    classic browser scripts (src/*.js, client/*.js): compiled as scripts
// Tracked Python tools are byte-compiled too when python3 is available.
//
//   node tools/check-syntax.cjs            -> lists failures, exit 1 if any
//   node tools/check-syntax.cjs --verbose  -> also lists every file checked
'use strict';
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const verbose = process.argv.includes('--verbose');
// Generated output and third-party code; the Unreal source reference is a synced copy of src/ and tests/.
const EXCLUDE = [/^node_modules\//, /^dist\//, /^build\//, /^release\//, /^unreal\//];

const tracked = execFileSync('git', ['ls-files', '-z', '*.js', '*.cjs', '*.mjs', '*.py'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0').filter(f => f && !EXCLUDE.some(rx => rx.test(f)) && fs.existsSync(path.join(ROOT, f)));

// Top-level import/export declarations (not `import(` calls, not inside strings at line start in practice).
const ESM = /^\s*(import\s+[\w{*'"]|import\s*\{|export\s+(\{|\*|default\b|(async\s+)?function\b|class\b|const\b|let\b|var\b))/m;
const stripHashbang = src => src.startsWith('#!') ? '//' + src.slice(2) : src;

const failures = [], modules = [], python = [];
let checked = 0;
for (const file of tracked) {
  if (file.endsWith('.py')) { python.push(file); continue; }
  const src = stripHashbang(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  if (file.endsWith('.mjs') || (file.endsWith('.js') && ESM.test(src))) { modules.push(file); continue; }
  try {
    if (file.endsWith('.cjs')) new vm.Script('(function (exports, require, module, __filename, __dirname) {' + src + '\n})', { filename: file });
    else new vm.Script(src, { filename: file });
    checked++; if (verbose) console.log('ok  ' + file);
  } catch (e) {
    failures.push(file + ': ' + String(e && e.message || e));
  }
}
for (const file of modules) {
  const r = spawnSync(process.execPath, ['--check', file], { cwd: ROOT, encoding: 'utf8' });
  if (r.status === 0) { checked++; if (verbose) console.log('ok  ' + file); }
  else {
    const lines = (r.stderr || r.stdout).trim().split('\n').filter(Boolean);
    failures.push(file + ': ' + (lines.find(l => /Error\b/.test(l)) || lines[0] || 'node --check failed'));
  }
}

let pyChecked = 0;
if (python.length) {
  // compile() parses without writing .pyc files anywhere
  const script = 'import sys\nbad=0\nfor f in sys.argv[1:]:\n  try: compile(open(f,"rb").read(), f, "exec", dont_inherit=True)\n  except SyntaxError as e: bad+=1; print("%s: %s (line %s)" % (f, e.msg, e.lineno))\nsys.exit(1 if bad else 0)';
  const py = spawnSync('python3', ['-c', script, ...python], { cwd: ROOT, encoding: 'utf8' });
  if (py.error) console.log('python3 not found: skipped ' + python.length + ' Python files');
  else {
    pyChecked = python.length;
    if (py.status !== 0) for (const line of py.stdout.trim().split('\n').filter(Boolean)) { failures.push(line); pyChecked--; }
  }
}

for (const f of failures) console.error('FAIL ' + f);
console.log(`syntax: ${checked} JavaScript files (${modules.length} ES modules) and ${pyChecked} Python files ok, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
