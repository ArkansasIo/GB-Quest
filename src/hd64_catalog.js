// Runtime access to the generated 6,000-image HD64 catalog. Atlases are loaded on demand.
'use strict';
(function (root) {
  const PREFIX = 'assets_hd64/gbq_6000/';
  const cache = new Map();
  const pending = new Map();
  let indexPromise = null;
  const maxCache = 128;
  const hash = value => {
    let h = 2166136261;
    for (const ch of String(value || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  const fetchJson = async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Asset catalog request failed: ' + url + ' (' + response.status + ')');
    return response.json();
  };
  async function loadIndex() {
    if (!indexPromise) {
      indexPromise = (async () => {
        if (root.GBQ_6000_ASSET_INDEX && root.GBQ_6000_ASSET_INDEX.assets) return root.GBQ_6000_ASSET_INDEX;
        return fetchJson(PREFIX + 'metadata/atlas_index.json');
      })().catch(error => { indexPromise = null; throw error; });
    }
    return indexPromise;
  }
  async function loadAtlas(path) {
    if (pending.has(path)) return pending.get(path);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('HD64 catalog atlas unavailable: ' + path));
      const embedded = root.GBQ_6000_ATLASES && root.GBQ_6000_ATLASES[path];
      image.src = embedded || PREFIX + path;
    }).finally(() => pending.delete(path));
    pending.set(path, promise);
    return promise;
  }
  function remember(id, canvas) {
    cache.delete(id);
    cache.set(id, canvas);
    while (cache.size > maxCache) cache.delete(cache.keys().next().value);
    if (root.IMG && typeof root.IMG === 'object') root.IMG['gbq6000_' + id] = canvas;
    return canvas;
  }
  async function get(id) {
    id = String(id || '');
    if (cache.has(id)) {
      const image = cache.get(id);
      cache.delete(id); cache.set(id, image);
      return image;
    }
    const catalog = await loadIndex();
    const entry = catalog.assets && catalog.assets[id];
    if (!entry) return null;
    const atlas = await loadAtlas(entry.atlas);
    const rect = entry.rect;
    if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite)) throw new Error('Invalid atlas rectangle for ' + id);
    const canvas = document.createElement('canvas');
    canvas.width = rect[2]; canvas.height = rect[3];
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.drawImage(atlas, rect[0], rect[1], rect[2], rect[3], 0, 0, rect[2], rect[3]);
    return remember(id, canvas);
  }
  async function pick(category, seed) {
    const catalog = await loadIndex();
    const ids = Object.keys(catalog.assets || {}).filter(id => catalog.assets[id].category === category);
    if (!ids.length) return null;
    return ids[hash(seed) % ids.length];
  }
  function draw(context, id, x, y, width, height) {
    if (!context || typeof context.drawImage !== 'function') return false;
    const ready = cache.get(String(id));
    if (ready) {
      context.drawImage(ready, x, y, width == null ? ready.width : width, height == null ? ready.height : height);
      return true;
    }
    get(id).catch(error => console.warn('GBQ 6000 asset load failed:', error));
    return false;
  }
  async function info(id) {
    const catalog = await loadIndex();
    return catalog.assets && catalog.assets[String(id)] || null;
  }
  function clear() { cache.clear(); }
  root.GBQ6000Assets = Object.freeze({ load: loadIndex, get, pick, draw, info, clear, hash });
})(typeof window !== 'undefined' ? window : globalThis);
