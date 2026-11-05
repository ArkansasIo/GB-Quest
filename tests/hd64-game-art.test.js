import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const engine = fs.readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
const adapter = fs.readFileSync(new URL('../src/hd64_game_art.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('HD64 boot preloads every atlas page and uses HD64 as the first-run visual mode', () => {
  assert.match(engine, /video: 'hd64'/);
  assert.match(engine, /palette: 'full'/);
  assert.match(engine, /async function preloadHd64Atlases/);
  assert.match(engine, /await preloadHd64Atlases\(\)/);
  assert.match(engine, /window\.GBQ_HD64_INDEXES = indexes/);
  assert.match(html, /src="src\/hd64_game_art\.js"/);
});

test('HD64 atlas adapter maps equipment categories and deterministic monster art', () => {
  const context = {
    window: { GBQ_HD64_INDEXES: {
      equipment: { ne_sword_0: [0,0,0,16,16], ne_sword_1: [0,16,0,16,16], ne_potion_0: [0,32,0,16,16] },
      monsters: { nm_dragon_0: [0,0,0,32,32], nm_undead_0: [0,32,0,32,32] },
      ui_kit: { au_buttons_000: [0,0,0,32,32] }
    } },
    NES: {}, BESTIARY: [
      { fam: 'dragon', sub: 'wyrm', variant: 'ancient' },
      { fam: 'undead', sub: 'skeleton', variant: 'guard' }
    ],
    applyArt() { this.applied = true; }
  };
  vm.runInNewContext(adapter, context);
  const status = context.window.GBQ_HD64_APPLY_ART();
  assert.deepEqual(Array.from(context.NES.sword), ['ne_sword_0','ne_sword_1']);
  assert.deepEqual(Array.from(context.NES.potion), ['ne_potion_0']);
  assert.ok(context.BESTIARY.every(entry => entry.nspr));
  assert.equal(status.equipmentMapped, 3);
  assert.equal(status.spriteCount, 6);
  assert.equal(context.window.GBQ_HD64_ASSET_LIBRARY.resolve('au_buttons_000').atlas, 'assets_hd64/ui_kit_0.png');
});
