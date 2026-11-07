const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const assetDir = path.join(root, 'assets');
const target = path.join(assetDir, 'woods_pixels.png');

if (!fs.existsSync(target)) throw new Error(`Missing imported woods sheet: ${target}`);
const png = fs.readFileSync(target);
if (png.readUInt32BE(16) !== 352 || png.readUInt32BE(20) !== 192) {
  throw new Error('Unexpected woods sheet dimensions; expected 352x192.');
}

const indexPath = path.join(assetDir, 'index.json');
const names = fs.readdirSync(assetDir)
  .filter(file => file.toLowerCase().endsWith('.png'))
  .map(file => file.slice(0, -4))
  .sort();
fs.writeFileSync(indexPath, `${JSON.stringify(names)}\n`);

const embeddedAssets = Object.fromEntries(names.map(name => {
  const bytes = fs.readFileSync(path.join(assetDir, `${name}.png`));
  return [name, `data:image/png;base64,${bytes.toString('base64')}`];
}));
const oldSceneArt = "blit(sprFit(scene.art || 'px_waypoint', 48), 56 + Math.round(Math.sin(this.t / 21) * 3), 34 + Math.round(Math.sin(this.t / 15) * 2));";
const newSceneArt = `const suppliedScene = !this.expansion && IMG.ap_scene_shadowbane;
    if (suppliedScene) {
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(suppliedScene, 0, 0, suppliedScene.width, suppliedScene.height, 0, 18, W, 60);
      ctx.restore();
      fill(0, 18, W, 60, 'rgba(7,8,22,.18)');
    } else {
      ${oldSceneArt}
    }`;
const enemyIndexLine = "const CITADEL_BOSSES = ['ember-ancient','frost-tyrant','void-oracle','dread-colossus','storm-seraph','hollow-king'];";
const enemyArtFunction = [
  enemyIndexLine,
  'let AP_PACK_ENEMIES = null;',
  'function assetPackEnemyFor(b) {',
  "  if (S.art !== 'packs' || !b) return null;",
  "  AP_PACK_ENEMIES ||= Object.keys(IMG).filter(name => /^ap_enemies_\\d+$/.test(name)).sort();",
  '  if (!AP_PACK_ENEMIES.length) return null;',
  '  const familyIndex = { ooze: 0, beast: 4, humanoid: 2, undead: 3, fiend: 13, dragon: 7, giant: 10, plant: 12, aberration: 8, monstrosity: 10, fey: 12 };',
  '  const index = familyIndex[b.fam] ?? hashStr(String(b.fam) + "|" + String(b.sub) + "|" + String(b.variant) + "|" + String(b.id)) % AP_PACK_ENEMIES.length;',
  "  const preferred = 'ap_enemies_' + String(index).padStart(3, '0');",
  '  return IMG[preferred] ? preferred : AP_PACK_ENEMIES[index % AP_PACK_ENEMIES.length];',
  '}',
  'const monsterArt = b => {'
].join('\n');
const npcOld = `function assetPackNpc(e) {
  if (S.art !== 'packs') return null;
  AP_WORLD_NPCS ||= Object.keys(IMG).filter(name => /^ap_npcs_\\d+$/.test(name)).sort();
  if (!AP_WORLD_NPCS.length) return null;
  const name = AP_WORLD_NPCS[npcHash(e && (e.name || e.spr) || '') % AP_WORLD_NPCS.length];
  return IMG[name] ? spr(name, 16, 32) : null;
}`;
const npcNew = `function assetPackNpc(e) {
  if (S.art !== 'packs') return null;
  AP_WORLD_NPCS ||= Object.keys(IMG).filter(name => /^ap_npcs_\\d+$/.test(name)).sort();
  AP_WORLD_CHARACTERS ||= Object.keys(IMG).filter(name => /^ap_characters_\\d+$/.test(name)).sort();
  const pool = AP_WORLD_NPCS.length ? AP_WORLD_NPCS : AP_WORLD_CHARACTERS;
  if (!pool.length) return null;
  const name = pool[npcHash(e && (e.name || e.spr) || '') % pool.length];
  return IMG[name] ? spr(name, 16, 32) : null;
}`;
for (const file of ['dist/gbquest.html', 'dist/gbquest-fullscreen.html']) {
  const bundlePath = path.join(root, file);
  if (!fs.existsSync(bundlePath)) continue;
  let html = fs.readFileSync(bundlePath, 'utf8');
  const marker = 'window.GB_ASSETS=';
  const start = html.indexOf(marker);
  const end = start < 0 ? -1 : html.indexOf(';</script>', start);
  if (start < 0 || end < 0) throw new Error(`Cannot find embedded asset table in ${file}.`);
  const table = JSON.parse(html.slice(start + marker.length, end));
  Object.assign(table, embeddedAssets);
  html = html.slice(0, start) + marker + JSON.stringify(table) + html.slice(end);
  const buggyLookup = 'return WOODS_SPRITES.get(name);';
  if (html.includes(buggyLookup)) html = html.replace(buggyLookup, 'return WOODS_SPRITES.get(key);');
  if (!html.includes('return WOODS_SPRITES.get(key);')) throw new Error(`Woods sprite cache lookup not found in ${file}.`);
  if (html.includes(oldSceneArt)) html = html.replace(oldSceneArt, newSceneArt);
  if (!html.includes('IMG.ap_scene_shadowbane')) throw new Error(`Prologue artwork hook not found in ${file}.`);
  const oldEnemyStart = `${enemyIndexLine}\nconst monsterArt = b => {`;
  if (html.includes(oldEnemyStart)) html = html.replace(oldEnemyStart, enemyArtFunction);
  else {
    const oldCrLf = oldEnemyStart.replaceAll('\n', '\r\n');
    if (html.includes(oldCrLf)) html = html.replace(oldCrLf, enemyArtFunction.replaceAll('\n', '\r\n'));
  }
  const suppliedEnemyLine = 'const supplied = assetPackEnemyFor(b);';
  if (!html.includes(suppliedEnemyLine)) html = html.replace('const monsterArt = b => {', `const monsterArt = b => {\n  ${suppliedEnemyLine}\n  if (supplied) return supplied;`);
  if (!html.includes('function assetPackEnemyFor(b)') || !html.includes(suppliedEnemyLine)) throw new Error(`Enemy artwork hook not found in ${file}.`);
  if (html.includes(npcOld)) html = html.replace(npcOld, npcNew);
  else {
    const npcOldCrLf = npcOld.replaceAll('\n', '\r\n');
    if (html.includes(npcOldCrLf)) html = html.replace(npcOldCrLf, npcNew.replaceAll('\n', '\r\n'));
  }
  if (!html.includes('const pool = AP_WORLD_NPCS.length ? AP_WORLD_NPCS : AP_WORLD_CHARACTERS;')) throw new Error(`Character fallback for NPCs not found in ${file}.`);
  fs.writeFileSync(bundlePath, html);
}

console.log(`Wired ${names.length} imported PNG assets into the source index and browser bundles.`);
