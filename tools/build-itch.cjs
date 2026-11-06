const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'build', 'itch');
const source = path.join(dist, 'gbquest-fullscreen.html');
const index = path.join(out, 'index.html');
const zip = path.join(root, 'build', 'gbquest-itch-html5.zip');
const hdAnimations = path.join(root, 'assets_hd64', 'animations');
const hdEquipment = path.join(root, 'assets_hd64', 'equipment');
const visualMap = path.join(root, 'data', 'visuals', 'equipment-catalog-visual-map.json');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + ' exited with status ' + result.status);
}

run(process.execPath, [path.join(root, 'tools', 'build.cjs')]);
if (!fs.existsSync(source)) throw new Error('Missing browser release output: ' + source);
for (const required of [
  path.join(hdAnimations, 'animation_manifest.json'),
  path.join(hdAnimations, 'frames'),
  path.join(hdEquipment, 'equipment_manifest.json'),
  visualMap
]) {
  if (!fs.existsSync(required)) throw new Error('Missing generated HD character pack input: ' + required);
}
const frameFiles = [];
function collectPngs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectPngs(full);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) frameFiles.push(full);
  }
}
collectPngs(path.join(hdAnimations, 'frames'));
if (frameFiles.length < 408) {
  throw new Error('HD animation pack is incomplete: expected at least 408 generated PNG frames, found ' + frameFiles.length);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(source, index);
fs.cpSync(hdAnimations, path.join(out, 'assets_hd64', 'animations'), { recursive: true });
fs.cpSync(hdEquipment, path.join(out, 'assets_hd64', 'equipment'), { recursive: true });
fs.mkdirSync(path.join(out, 'data', 'visuals'), { recursive: true });
fs.copyFileSync(visualMap, path.join(out, 'data', 'visuals', path.basename(visualMap)));

const html = fs.readFileSync(index, 'utf8');
if (!html.includes('id="lcd"') || !html.includes('GB_ASSETS')) {
  throw new Error('The itch.io page is missing the game canvas or embedded asset catalog.');
}
for (const required of [
  'gbq_master_catalog',
  'gbq_ui_mockup_catalog',
  'GBQ_HD64_ATLASES',
  'theme-shadows',
  'theme-pokemon',
  'POKEMON CLASSIC',
  'class="theme-shadows theme-pokemon"'
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
files = sorted(p for p in source.rglob("*") if p.is_file())
required = [
    pathlib.Path("index.html"),
    pathlib.Path("assets_hd64/animations/animation_manifest.json"),
    pathlib.Path("assets_hd64/equipment/equipment_manifest.json"),
    pathlib.Path("data/visuals/equipment-catalog-visual-map.json"),
]
relative = {p.relative_to(source) for p in files}
missing = [str(p) for p in required if p not in relative]
assert not missing, f"Missing required ZIP entries: {missing}"
with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        archive.write(path, path.relative_to(source).as_posix())
with zipfile.ZipFile(target) as archive:
    names = set(archive.namelist())
    assert all(str(p) in names for p in required), names
    assert archive.getinfo("index.html").file_size > 100_000
    assert any(name.startswith("assets_hd64/animations/frames/") and name.endswith(".png") for name in names)
print(f"Created {target} ({target.stat().st_size / 1024 / 1024:.2f} MiB, {len(files)} files)")`;
const candidates = process.platform === 'win32'
  ? [['py', ['-3', '-c', py, out, zip]], ['python', ['-c', py, out, zip]]]
  : [['python3', ['-c', py, out, zip]], ['python', ['-c', py, out, zip]]];
let built = false;
let lastError;
for (const [command, args] of candidates) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (!result.error && result.status === 0) { built = true; break; }
  lastError = result.error || new Error(command + ' exited with status ' + result.status);
}
if (!built) throw lastError || new Error('Python 3 is required to create the itch.io ZIP.');
console.log('itch.io upload: build/gbquest-itch-html5.zip');
console.log('ZIP root: index.html plus assets_hd64/ and data/visuals/');
