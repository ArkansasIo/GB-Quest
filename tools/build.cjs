const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ORDER = ['data_rules', 'jobs_data', 'data_world', 'gen', 'creatures', 'rooms', 'engine', 'audio64', 'video64', 'rules', 'combat', 'mmorpg/systems/pvp', 'systems', 'rank-system', 'art', 'scenes_menu', 'scenes_world', 'npc_art', 'inventory', 'items', 'gems', 'runes', 'boss_rewards', 'boss_progression', 'easter_eggs', 'secret_world', 'gem_ui', 'rune_ui', 'armory', 'trinkets', 'profperks', 'materials', 'companions', 'arts', 'netlocal', 'market', 'heirlooms', 'mmo_loop', 'keystones', 'dread', 'polish', 'hd_character_art', 'durability', 'guild_prog', 'world_quests', 'loadouts', 'jobs', 'necro_army', 'towns', 'npc_ai', 'ui_dark', 'ui_mmo', 'battlebg', 'asset_pack', 'pack_index', 'pack_art', 'mount_data', 'mounts', 'tnl_systems', 'tnl_extras', 'guild_war', 'extras', 'aspects_data', 'd4_gear', 'totems', 'awakening', 'guide', 'chatwow', 'admin', 'chatbox', 'chatframe', 'identity', 'main', 'debug'];

const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const clientFile = (name) => name === 'main' ? 'client/main.js' : `src/${name}.js`;

const nes = '<script>window.NES_INDEX=' + JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'nes_index.json'), 'utf8'))) + ';</script>\n';
const hd64Files = fs.readdirSync(path.join(ROOT, 'assets_hd64')).filter(f => f.endsWith('.png')).sort();
const hd64Atlases = Object.fromEntries(hd64Files.map(f => [f.slice(0, -4), 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets_hd64', f)).toString('base64')]));
const hd64Indexes = Object.fromEntries(fs.readdirSync(path.join(ROOT, 'assets_hd64')).filter(f => f.endsWith('.json')).map(f => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(ROOT, 'assets_hd64', f), 'utf8'))]));
const hd64 = '<script>window.GBQ_HD64_ATLASES=' + JSON.stringify(hd64Atlases) + ';window.GBQ_HD64_INDEXES=' + JSON.stringify(hd64Indexes) + ';</script>\n';
const citadelFiles = [];
function walkCitadel(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkCitadel(full);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.svg')) {
      const rel = path.relative(ROOT, full).split(path.sep).join('/');
      citadelFiles.push([rel, 'data:image/svg+xml;base64,' + fs.readFileSync(full).toString('base64')]);
    }
  }
}
walkCitadel(path.join(ROOT, 'assets_citadel'));
const citadel = '<script>window.GBQ_CITADEL_ASSETS=' + JSON.stringify(Object.fromEntries(citadelFiles)) + ';</script>\n';
const shell = rd('client/shell.html');

const files = fs.readdirSync(path.join(ROOT, 'assets'))
  .filter(f => f.endsWith('.png') && !f.startsWith('device_mockup') && !f.startsWith('bg_patterns'))
  .sort();

const names = files.map(f => f.slice(0, -4));
fs.writeFileSync(path.join(ROOT, 'assets', 'index.json'), JSON.stringify(names));

const dev = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  + shell.replace('<aside', '</head><body>\n<aside') + '\n' + nes + '<script>fetch("dist/atlas.html").then(r => r.text()).then(t => window.ATLAS_HTML = t).catch(() => {});</script>\n'
  + ORDER.map(n => `<script src="${clientFile(n)}"></script>\n`).join('') + '</body></html>\n';
fs.writeFileSync(path.join(ROOT, 'index.html'), dev);

const assets = {};
for (const n of names) {
  const b64 = fs.readFileSync(path.join(ROOT, 'assets', n + '.png')).toString('base64');
  assets[n] = 'data:image/png;base64,' + b64;
}

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const atlas = '<script>window.ATLAS_HTML=' + JSON.stringify(rd('dist/atlas.html')).replace(/<\//g, '<\\/') + ';</script>\n';
const single = shell + '\n<script>window.GB_ASSETS=' + JSON.stringify(assets) + ';</script>\n' + nes + atlas
  + hd64 + citadel + ORDER.map(n => `<script>\n${rd(clientFile(n))}\n</script>\n`).join('');
fs.writeFileSync(path.join(ROOT, 'dist', 'gbquest.html'), single);

const fsHtml = rd('client/fullscreen.html');
let full = single.replace('<title>Lost Kingdom of Shadowbane Chronicles</title>', '<title>Lost Kingdom of Shadowbane Chronicles Full Screen</title>')
  .replace('</style>', '</style>\n' + fsHtml.split('<div class="fsbar"')[0]);
full = full.replace('<section class="chat"', '<div class="fsbar"' + fsHtml.split('<div class="fsbar"')[1] + '\n<section class="chat"');
fs.writeFileSync(path.join(ROOT, 'dist', 'gbquest-fullscreen.html'), full);

console.log(`Built index.html + dist/gbquest.html (${Math.round(single.length / 1024)} KB, ${Object.keys(assets).length} assets)`);

