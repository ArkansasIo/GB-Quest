import test from 'node:test';
import assert from 'node:assert/strict';
import art from '../src/hd_character_art.js';

test('HD frame paths accept only supported coordinates and animation indices', () => {
  assert.equal(
    art.framePath('assets_hd64/animations/frames', 'warrior', 'F', 'SW', 'walk', 7),
    'assets_hd64/animations/frames/warrior/F/SW/walk/frame_007.png'
  );
  assert.equal(art.framePath('/frames/', 'mage', 'SS', 'N', 'cast', 0),
    '/frames/mage/SS/N/cast/frame_000.png');
  for (const args of [
    ['../escape', 'F', 'S', 'idle', 0],
    ['warrior', '../F', 'S', 'idle', 0],
    ['warrior', 'F', '../S', 'idle', 0],
    ['warrior', 'F', 'S', '../idle', 0],
    ['warrior', 'F', 'S', 'idle', -1],
    ['warrior', 'F', 'S', 'idle', 100]
  ]) {
    assert.equal(art.framePath('/frames', ...args), null);
  }
});

test('direction input normalizes compass names and defaults safely', () => {
  assert.equal(art.directionForInput('southwest'), 'SW');
  assert.equal(art.directionForInput('north'), 'N');
  assert.equal(art.directionForInput('east'), 'E');
  assert.equal(art.directionForInput('NW'), 'NW');
  assert.equal(art.directionForInput('invalid-direction'), 'S');
});

test('gameplay states map to supported animation sequences', () => {
  assert.equal(art.animationForState('sprinting'), 'run');
  assert.equal(art.animationForState('channeling'), 'cast');
  assert.equal(art.animationForState('melee'), 'attack');
  assert.equal(art.animationForState('stagger'), 'hit');
  assert.equal(art.animationForState('dying'), 'death');
  assert.equal(art.animationForState('unknown'), 'idle');
});

test('class names resolve to the supported character archetypes', () => {
  assert.equal(art.archetypeForClass('Shadow Ranger'), 'ranger');
  assert.equal(art.archetypeForClass('Void-Assassin'), 'rogue');
  assert.equal(art.archetypeForClass('Dark Sorceress'), 'mage');
  assert.equal(art.archetypeForClass('Blood Necromancer'), 'summoner');
  assert.equal(art.archetypeForClass('unknown class'), 'warrior');
});

test('equipment resolution respects transmog appearance and slot contracts', () => {
  const character = {
    cls: 'Shadow Ranger',
    eq: {
      weapon: { kind: 'weapon', base: 'iron_sword', tmog: { kind: 'weapon', base: 'short_bow' } },
      armor: { kind: 'armor', base: 'iron_plate' },
      offhand: { kind: 'offhand', base: 'iron_shield' }
    }
  };
  const visualMap = { records: [
    { catalogId: 'weapon:short_bow', slot: 'main_hand', visualItemId: 'short_bow' },
    { catalogId: 'armor:iron_plate', slot: 'chest', visualItemId: 'iron_plate' },
    { catalogId: 'offhand:iron_shield', slot: 'off_hand', visualItemId: 'iron_shield' }
  ] };
  assert.deepEqual(art.resolveEquipment(character, visualMap, 'A'), {
    archetype: 'ranger', rank: 'A',
    equipment: { main_hand: 'short_bow', chest: 'iron_plate', off_hand: 'iron_shield' }
  });
});

test('frame presenter deduplicates pending renders and returns ready frames', async () => {
  const canvas = { id: 'rendered-frame' };
  let renders = 0;
  const presenter = art.createFramePresenter({
    renderCharacter: async () => { renders += 1; return canvas; }
  });
  const character = { id: 'player-1', cls: 'warrior' };
  const spec = { direction: 'S', animation: 'idle', frame: 0 };
  assert.equal(presenter.request(character, spec), null);
  assert.equal(presenter.request(character, spec), null);
  assert.equal(renders, 1);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(presenter.request(character, spec), canvas);
  assert.equal(presenter.getReady(), canvas);
  assert.equal(presenter.cacheSize(), 1);
  presenter.clear();
  assert.equal(presenter.cacheSize(), 0);
  assert.equal(presenter.getReady(), null);
});
