import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { needs, IMAGES } from './support/needs.js';

// NES CLASSIC (tools/gen_nes8.py): flat four-colour NES-palette tiles for every overworld and dungeon tile key.
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const assets = () => fs.readdirSync(new URL('../assets/', import.meta.url));
const GROUPS = ['green', 'sand', 'snow', 'swamp', 'lava', 'mystic', 'dark', 'jungle'];
const THEMES = ['dungeon', 'crypt', 'ice', 'lava', 'temple', 'void'];

test('the generator keeps every tile to four NES colours', () => {
  const gen = read('tools/gen_nes8.py');
  assert.match(gen, /assert len\(cols\) <= 4/);
  assert.match(gen, /assert cols <= NES_RGB/);
  for (const g of GROUPS) assert.match(gen, new RegExp(`'${g}':\\s+pal\\(`), g);
});

test('every RETRO 8-BIT tile has an NES CLASSIC tile in every palette and theme (16x16)', { skip: needs(IMAGES) }, () => {
  const all = new Set(assets());
  const worldKeys = [...all].filter(f => f.startsWith('gt_r8green_')).map(f => f.slice('gt_r8green_'.length));
  const dunKeys = [...all].filter(f => f.startsWith('gd_r8dungeon_')).map(f => f.slice('gd_r8dungeon_'.length));
  assert.equal(worldKeys.length, 75); assert.equal(dunKeys.length, 26);
  for (const g of GROUPS) for (const k of worldKeys) assert.ok(all.has(`gt_n8${g}_${k}`), `gt_n8${g}_${k}`);
  for (const t of THEMES) for (const k of dunKeys) assert.ok(all.has(`gd_n8${t}_${k}`), `gd_n8${t}_${k}`);
  for (const f of [...all].filter(f => /^g[td]_n8/.test(f))) {
    const b = fs.readFileSync(new URL(`../assets/${f}`, import.meta.url));
    assert.deepEqual([b.readUInt32BE(16), b.readUInt32BE(20)], [16, 16], f);
  }
});

test('NES CLASSIC is a real art mode: its tiles, the 8-bit sprites, and it survives a reload', () => {
  const art = read('src/art.js');
  assert.match(art, /const retroSprites = \(\) => S\.art === 'retro' \|\| S\.art === 'nes';/);
  assert.match(art, /if \(S\.art === 'nes'\) \{\s*const nes = m\[1\] === 'd' \? `gd_n8/);
  const gen = read('tools/gen_nes8.py');
  const biomes = [...art.match(/const NES_TILE_GROUP = \{([^}]*)\}/)[1].matchAll(/(\w+): '(\w+)'/g)].map(m => `${m[1]}:${m[2]}`).sort();
  const genBiomes = [...gen.match(/BIOME_GROUP = \{([^}]*)\}/)[1].matchAll(/'(\w+)': '(\w+)'/g)].map(m => `${m[1]}:${m[2]}`).sort();
  assert.deepEqual(biomes, genBiomes, 'src/art.js and the generator agree on which biome uses which palette');
  assert.match(read('src/scenes_world.js'), /S\.art === 'nes' \|\| S\.art === 'aelmoor'\) && typeof window\.retroWorldTile/);
  assert.match(read('src/scenes_menu.js'), /'NES CLASSIC'/);
  assert.match(read('src/scenes_world.js'), /S\.art !== 'classic' && S\.art !== 'nes' && IMG\.woods_pixels/, 'no painted tree overlays over the flat NES trees');
  const packArt = read('src/pack_art.js');
  assert.doesNotMatch(packArt, /if \(S\.art === 'nes'\) \{ S\.art = PACK_MODE/, 'choosing NES CLASSIC must not turn into FULL DETAIL on reload');
  assert.match(packArt, /classic: 'nes', nes: 'packs'/);
});
