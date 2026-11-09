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

test('failed frame renders are retried after the configured backoff', async () => {
  let calls = 0;
  const canvas = { width: 128, height: 128 };
  const presenter = art.createFramePresenter({
    renderCharacter: async () => {
      calls += 1;
      if (calls === 1) throw new Error('asset temporarily unavailable');
      return canvas;
    }
  }, { retryDelayMs: 0 });
  const character = { id: 'recovering-frame', cls: 'warrior', archetype: 'warrior', eq: {} };
  const spec = { direction: 'S', state: 'idle', frame: 0 };

  presenter.request(character, spec);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(presenter.cacheSize(), 0);
  assert.equal(presenter.request(character, spec), null);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(presenter.request(character, spec), canvas);
  assert.equal(calls, 2);
});

test('frame cache keys distinguish characters with the same id but different archetypes', async () => {
  let calls = 0;
  const presenter = art.createFramePresenter({
    renderCharacter: async character => ({ archetype: character.archetype, call: ++calls })
  });
  const base = { id: 'shared-id', cls: 'warrior', eq: {} };
  presenter.request({ ...base, archetype: 'warrior' }, { frame: 0 });
  await new Promise(resolve => setImmediate(resolve));
  presenter.request({ ...base, archetype: 'mage' }, { frame: 0 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.equal(presenter.request({ ...base, archetype: 'mage' }, { frame: 0 }).archetype, 'mage');
});
