#!/usr/bin/env node
// Make a release.
//   1. Add the release's notes at the top of patch-notes.json ("version": the new number).
//   2. Commit your work, then: node tools/release.cjs 2.3.0 [--no-push]
// This sets the version in src/data_world.js (BUILD), package.json and game-metadata.json, regenerates
// src/patch_notes.js, adds the notes to CHANGELOG.md, rebuilds dist/ and the itch.io zip, runs the tests,
// commits, tags v<version> and pushes. The tag starts .github/workflows/release.yml, which publishes the
// GitHub Release with the notes, the itch.io zip, gbquest.html and the source zip.
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const notes = require('./patch-notes.cjs');

const ROOT = path.join(__dirname, '..');
const run = (cmd, opts = {}) => execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
const args = process.argv.slice(2), version = (args.find(a => !a.startsWith('--')) || '').replace(/^v/, '');
const push = !args.includes('--no-push');
if (!/^\d+\.\d+\.\d+$/.test(version)) { console.error('usage: node tools/release.cjs <MAJOR.MINOR.PATCH> [--no-push]'); process.exit(1); }

// everything except the new notes must already be committed, so the release commit is complete
const dirty = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(l => l.trim() && !/ patch-notes\.json$/.test(l) && !/ package-lock\.json$/.test(l));
if (dirty.length) { console.error('Commit your changes first. Uncommitted:\n' + dirty.join('\n')); process.exit(1); }
const data = notes.load(), rel = data.releases[0];
if (rel.version !== version) { console.error(`patch-notes.json: the first release is v${rel.version}. Add the notes for v${version} at the top first.`); process.exit(1); }
const tagExists = (() => { try { execSync(`git rev-parse -q --verify refs/tags/v${version}`, { cwd: ROOT, stdio: 'ignore' }); return true; } catch (e) { return false; } })();
if (tagExists) { console.error(`tag v${version} already exists`); process.exit(1); }

const today = new Date().toISOString().slice(0, 10);
if (!rel.date) rel.date = today;
fs.writeFileSync(path.join(ROOT, 'patch-notes.json'), JSON.stringify(data, null, 2) + '\n');

// version everywhere
const edit = (file, fn) => { const p = path.join(ROOT, file); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); };
edit('src/data_world.js', s => s.replace(/(\n\s*version: ')[^']*(',)/, `$1${version}$2`).replace(/(\n\s*build: 'B)[^']*(',)/, `$1${rel.date.replace(/-/g, '.')}$2`));
for (const f of ['package.json', 'game-metadata.json']) edit(f, s => s.replace(/"version": "[^"]*"/, `"version": "${version}"`));
run('node tools/patch-notes.cjs');

// changelog: add this release under the title if it is not there yet
edit('CHANGELOG.md', s => {
  if (s.includes(`## v${version}`)) return s;
  const md = notes.markdown(data, version).split('\n**Downloads:**')[0].trim();
  const at = s.indexOf('\n## ');
  return at < 0 ? `${s.trim()}\n\n${md}\n` : `${s.slice(0, at)}\n${md}\n${s.slice(at)}`;
});

run('npm run build:itch');
run('npm test');
run('git add -A patch-notes.json src/patch_notes.js src/data_world.js package.json game-metadata.json CHANGELOG.md dist index.html');
run(`git commit -m "Release v${version}${rel.title ? ': ' + rel.title : ''}"`);
run(`git tag -a v${version} -m "v${version}${rel.title ? ' - ' + rel.title : ''}"`);
if (push) { run('git push origin HEAD'); run(`git push origin v${version}`); console.log(`\nPushed v${version}. GitHub Actions now publishes the release: https://github.com/${data.repo}/releases/tag/v${version}`); }
else console.log(`\nTagged v${version} locally. Push with: git push origin HEAD && git push origin v${version}`);
