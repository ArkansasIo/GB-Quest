const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'build', 'itch');
const source = path.join(dist, 'gbquest-fullscreen.html');
const index = path.join(out, 'index.html');
const zip = path.join(root, 'build', 'gbquest-itch-html5.zip');
const MAX_FILES = 1000;

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

// Embed generated HD64 PNGs as data URIs inside the one-file HTML release.
// This preserves runtime URL semantics while keeping the ZIP entry count at one.
function collectPngs(directory, archiveRoot) {
  const result = {};
  if (!fs.existsSync(directory)) return result;
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
        const relative = path.relative(directory, full).split(path.sep).join('/');
        result[archiveRoot + '/' + relative] = 'data:image/png;base64,' + fs.readFileSync(full).toString('base64');
      }
    }
  }
  walk(directory);
  return result;
}
const animationRoot = 'assets_hd64/animations/frames';
const equipmentRoot = 'assets_hd64/equipment';
const animationManifestPath = path.join(root, 'assets_hd64', 'animations', 'animation_manifest.json');
const equipmentManifestPath = path.join(root, equipmentRoot, 'equipment_manifest.json');
const visualMapPath = path.join(root, 'data', 'visuals', 'equipment-catalog-visual-map.json');
const images = {
  ...collectPngs(path.join(root, animationRoot), animationRoot),
  ...collectPngs(path.join(root, equipmentRoot), equipmentRoot)
};
const hasAnimationFrames = Object.keys(images).some(name => name.startsWith(animationRoot + '/'));
const hasEquipmentLayers = Object.keys(images).some(name => name.startsWith(equipmentRoot + '/'));
const hasManifests = [animationManifestPath, equipmentManifestPath, visualMapPath].every(fs.existsSync);
const hasHd64Pack = hasAnimationFrames && hasEquipmentLayers && hasManifests;
const hd64Pack = hasHd64Pack ? {
  available: true,
  images,
  animationManifest: JSON.parse(fs.readFileSync(animationManifestPath, 'utf8')),
  equipmentManifest: JSON.parse(fs.readFileSync(equipmentManifestPath, 'utf8')),
  visualMap: JSON.parse(fs.readFileSync(visualMapPath, 'utf8'))
} : { available: false, images: {} };
if (!hasHd64Pack) {
  console.warn('HD64 character art is not generated; the standalone game will use its classic character sprites.');
}
let html = fs.readFileSync(index, 'utf8');
const injectionPoint = '<script>window.NES_INDEX=';
if (!html.includes(injectionPoint)) throw new Error('Could not locate safe HD64 pack injection point.');
html = html.replace(injectionPoint, '<script>window.GBQ_HD64_PACK=' + JSON.stringify(hd64Pack) + ';</script>\n' + injectionPoint);
fs.writeFileSync(index, html);
if (!html.includes('id="lcd"') || !html.includes('GB_ASSETS')) {
  throw new Error('The itch.io page is missing the game canvas or embedded asset catalog.');
}
for (const required of [
  'gbq_master_catalog',
  'gbq_ui_mockup_catalog',
  'GBQ_HD64_ATLASES',
  'theme-shadows',
  'class="theme-shadows"'
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

// All generated F-rank HD64 animation frames, equipment layers, manifests and
// visual mappings are embedded in GBQ_HD64_PACK above. The runtime resolves its
// normal asset paths against that map, so the ZIP remains a single HTML file.
fs.mkdirSync(path.dirname(zip), { recursive: true });
fs.rmSync(zip, { force: true });
const archiveBuild = spawnSync(process.execPath, [path.join(__dirname, 'zip-single-html.cjs'), out, zip, String(MAX_FILES)], {
  cwd: root, stdio: 'inherit'
});
if (archiveBuild.error) throw archiveBuild.error;
if (archiveBuild.status !== 0) throw new Error('ZIP packaging failed with status ' + archiveBuild.status);
console.log('itch.io upload: build/gbquest-itch-html5.zip');
console.log('ZIP root: index.html (self-contained HTML5 game)');
