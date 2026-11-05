import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/hd_character_art.js';

const art = globalThis.GBQHDCharacterArt;

test('frame presenter requests a render once and returns its cached canvas', async () => {
  let calls = 0;
  const canvas = { width: 128, height: 128 };
  const presenter = art.createFramePresenter({
    renderCharacter: async () => { calls += 1; return canvas; }
  });
  const character = { id: 'blade-knight-1', cls: 'Blade Knight', rank: 'F', eq: {} };
  const spec = { direction: 'S', state: 'idle', frame: 0 };

  assert.equal(presenter.request(character, spec), null);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(presenter.request(character, spec), canvas);
  assert.equal(presenter.getReady(), canvas);
  assert.equal(calls, 1);
});

test('frame presenter bounds its LRU cache and clear resets it', async () => {
  let calls = 0;
  const presenter = art.createFramePresenter({
    renderCharacter: async character => { calls += 1; return { id: character.id }; }
  }, { maxEntries: 2 });
  const make = id => ({ id, cls: 'warrior', eq: {} });

  presenter.request(make('one'), { frame: 0 });
  presenter.request(make('two'), { frame: 0 });
  presenter.request(make('three'), { frame: 0 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(presenter.cacheSize(), 2);
  presenter.clear();
  assert.equal(presenter.cacheSize(), 0);
  assert.equal(presenter.getReady(), null);
  assert.equal(calls, 3);
});

test('failed frame renders do not become permanent cache entries', async () => {
  let calls = 0;
  const presenter = art.createFramePresenter({
    renderCharacter: async () => { calls += 1; throw new Error('asset missing'); }
  });
  const character = { id: 'missing-frame', cls: 'warrior', eq: {} };
  const spec = { direction: 'S', state: 'idle', frame: 0 };

  presenter.request(character, spec);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(presenter.cacheSize(), 0);
  assert.equal(presenter.request(character, spec), null);
  assert.equal(calls, 1);
});
