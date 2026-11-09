import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/hd_character_art.js';

const art = globalThis.GBQHDCharacterArt;

test('HD animation paths are deterministic and constrained to known dimensions', () => {
  assert.equal(
    art.framePath('assets_hd64/animations/frames', 'warrior', 'SSS', 'NE', 'death', 7),
    'assets_hd64/animations/frames/warrior/SSS/NE/death/frame_007.png'
  );
  assert.equal(art.framePath('assets', '../warrior', 'F', 'S', 'idle', 0), null);
  assert.equal(art.framePath('assets', 'warrior', 'F', 'S', 'idle', -1), null);
  assert.equal(art.framePath('assets', 'warrior', 'F', 'S', 'idle', 100), null);
  assert.equal(art.framePath('assets', 'warrior', 'F', 'S', 'teleport', 0), null);
});

test('HD direction and animation states normalize common gameplay values', () => {
  assert.equal(art.directionForInput('down'), 'S');
  assert.equal(art.directionForInput('northwest'), 'NW');
  assert.equal(art.directionForInput('NE'), 'NE');
  assert.equal(art.animationForState('sprinting'), 'run');
  assert.equal(art.animationForState('channeling'), 'cast');
  assert.equal(art.animationForState('dying'), 'death');
  assert.equal(art.animationForState('unknown-state'), 'idle');
});

test('equipment fallbacks select a family-appropriate visual without changing item data', () => {
  assert.deepEqual(art.fallbackVisual('weapon', 'dagger'), {
    slot: 'main_hand', visualItemId: 'paired_daggers'
  });
  assert.deepEqual(art.fallbackVisual('weapon', 'longbow'), {
    slot: 'main_hand', visualItemId: 'short_bow'
  });
  assert.deepEqual(art.fallbackVisual('weapon', 'warhammer'), {
    slot: 'main_hand', visualItemId: 'holy_mace'
  });
  assert.deepEqual(art.fallbackVisual('armor', 'arcane_robe'), {
    slot: 'chest', visualItemId: 'arcane_robe'
  });
  assert.deepEqual(art.fallbackVisual('offhand', 'tower_shield'), {
    slot: 'off_hand', visualItemId: 'iron_shield'
  });
});

test('HD rendering falls back to the highest available generated rank instead of missing higher-rank files', () => {
  const manifest = { items: [{ rank: 'F' }, { rank: 'F' }] };
  assert.equal(art.availableRank(manifest, 'F'), 'F');
  assert.equal(art.availableRank(manifest, 'E'), 'F');
  assert.equal(art.availableRank(manifest, 'SSS'), 'F');
  assert.equal(art.availableRank({ items: [{ rank: 'A' }] }, 'E'), 'A');
  assert.equal(art.availableRank({ items: [] }, 'E'), 'F');
});
