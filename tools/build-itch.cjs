const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'build', 'itch');
const source = path.join(dist, 'gbquest-fullscreen.html');
const index = path.join(out, 'index.html');
const zip = path.join(root, 'build', 'gbquest-itch-html5.zip');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + ' exited with status ' + result.status);
}

run(process.execPath, [path.join(root, 'tools', 'build.cjs')]);
if (!fs.existsSync(source)) throw new Error('Missing browser release output: ' + source);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(source, index);
const html = fs.readFileSync(index, 'utf8');
if (!html.includes('id="lcd"') || !html.includes('GB_ASSETS')) {
  throw new Error('The itch.io page is missing the game canvas or embedded asset catalog.');
}
// Release gate: confirm the new artwork is inside the running game build, not merely
// copied beside it. build.cjs inlines both catalog PNGs into the theme CSS and
// exposes the complete PNG/HD64 atlases to the game runtime.
for (const required of [
  'gbq_master_catalog',
  'gbq_ui_mockup_catalog',
  'GBQ_HD64_ATLASES',
  'theme-shadows',
  'theme-pokemon',
  'POKEMON CLASSIC',
  'class="theme-pokemon"'
]) {
  if (!html.includes(required)) throw new Error('Release is missing integrated artwork/runtime marker: ' + required);
}
if (html.includes('GBQ_MASTER_CATALOG') || html.includes('GBQ_UI_MOCKUP')) {
  throw new Error('Unresolved artwork placeholder remains in the release HTML.');
}
const embeddedPngs = html.split('data:image/png;base64,').length - 1;
if (embeddedPngs < 3) {
  throw new Error('Expected embedded game and UI artwork data URIs; found only ' + embeddedPngs);
}
if (/src=["'](?:\.\.\/|\.\/)?(?:src|assets)\//i.test(html)) {
  throw new Error('The itch.io HTML still references loose source or asset files.');
}
fs.mkdirSync(path.dirname(zip), { recursive: true });
fs.rmSync(zip, { force: true });
const py = String.raw`import pathlib, sys, zipfile
source = pathlib.Path(sys.argv[1])
target = pathlib.Path(sys.argv[2])
with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    archive.write(source, "index.html")
with zipfile.ZipFile(target) as archive:
    names = archive.namelist()
    assert names == ["index.html"], names
    assert archive.getinfo("index.html").file_size > 100_000
print(f"Created {target} ({target.stat().st_size / 1024 / 1024:.2f} MiB)")`;
const candidates = process.platform === 'win32'
  ? [['py', ['-3', '-c', py, index, zip]], ['python', ['-c', py, index, zip]]]
  : [['python3', ['-c', py, index, zip]], ['python', ['-c', py, index, zip]]];
let built = false;
let lastError;
for (const [command, args] of candidates) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (!result.error && result.status === 0) { built = true; break; }
  lastError = result.error || new Error(command + ' exited with status ' + result.status);
}
if (!built) throw lastError || new Error('Python 3 is required to create the itch.io ZIP.');
console.log('itch.io upload: build/gbquest-itch-html5.zip');
console.log('ZIP root: index.html');
