import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/hd_character_art.js';

const art = globalThis.GBQHDCharacterArt;

test('Shadows of the Abyss classes resolve to supported HD archetypes', () => {
  assert.ok(art);
  const expected = {
    'Blade Knight': 'warrior',
    'Dark Sorceress': 'mage',
    'Shadow Ranger': 'ranger',
    'Abyssal Templar': 'cleric',
    'Void Assassin': 'rogue',
    'Blood Necromancer': 'summoner'
  };
  for (const [name, archetype] of Object.entries(expected)) {
    assert.equal(art.archetypeForClass(name), archetype, name);
  }
});

test('class resolver accepts separators and remains backward compatible', () => {
  assert.equal(art.archetypeForClass('blood_necromancer'), 'summoner');
  assert.equal(art.archetypeForClass('dark-sorceress'), 'mage');
  assert.equal(art.archetypeForClass('fighter'), 'warrior');
  assert.equal(art.archetypeForClass('ranger'), 'ranger');
});
