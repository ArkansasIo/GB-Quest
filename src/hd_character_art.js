// Optional HD character-art runtime. Generated packs are loaded on demand and never block boot.
'use strict';

(function (root) {
  const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
  const DIRECTIONS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
  const ANIMATIONS = ['idle', 'walk', 'run', 'attack', 'cast', 'block', 'hit', 'death'];
  const ARCHETYPES = ['warrior', 'mage', 'ranger', 'rogue', 'cleric', 'summoner'];
  const safe = (value, allowed) => allowed.includes(String(value)) ? String(value) : null;
  const framePath = (base, a, r, d, anim, frame) => {
    const archetype = safe(a, ARCHETYPES), rank = safe(r, RANKS);
    const direction = safe(d, DIRECTIONS), animation = safe(anim, ANIMATIONS);
    const index = Number(frame);
    if (!archetype || !rank || !direction || !animation || !Number.isInteger(index) || index < 0 || index > 99) return null;
    return `${String(base).replace(/\\/$/, '')}/${archetype}/${rank}/${direction}/${animation}/frame_${String(index).padStart(3, '0')}.png`;
  };
  const createRuntime = (options = {}) => {
    const frameRoot = options.frameRoot || 'assets_hd64/animations/frames';
    const equipmentRoot = options.equipmentRoot || 'assets_hd64/equipment';
    const manifestUrl = options.manifestUrl || `${equipmentRoot}/equipment_manifest.json`;
    const imageCache = new Map();
    let manifestPromise = null;
    const loadImage = url => {
      if (!imageCache.has(url)) imageCache.set(url, new Promise((resolve, reject) => {
        if (typeof Image === 'undefined') return reject(new Error('Image API unavailable'));
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Unable to load HD character asset: ${url}`));
        img.src = url;
      }));
      return imageCache.get(url);
    };
    const getManifest = () => {
      if (!manifestPromise) {
        manifestPromise = typeof fetch === 'function'
          ? fetch(manifestUrl).then(r => { if (!r.ok) throw new Error(`Equipment manifest HTTP ${r.status}`); return r.json(); })
          : Promise.reject(new Error('Fetch API unavailable'));
      }
      return manifestPromise;
    };
    const render = async spec => {
      if (!spec) throw new TypeError('Character render specification is required');
      const baseUrl = framePath(frameRoot, spec.archetype, spec.rank, spec.direction, spec.animation, spec.frame || 0);
      if (!baseUrl) throw new TypeError('Invalid archetype, rank, direction, animation, or frame');
      const [base, manifest] = await Promise.all([loadImage(baseUrl), getManifest()]);
      const width = Number(manifest.canvas && manifest.canvas.width), height = Number(manifest.canvas && manifest.canvas.height);
      if (!(width > 0 && height > 0)) throw new Error('Equipment manifest has invalid canvas dimensions');
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(base, 0, 0, width, height);
      const loadout = spec.equipment || {};
      const chosen = Object.entries(loadout).map(([slot, id]) => (manifest.items || []).find(item =>
        item.id === id && item.slot === slot && item.rank === spec.rank && item.direction === spec.direction
      )).filter(Boolean).sort((a, b) => ((manifest.slots[a.slot] || {}).draw_order || 0) - ((manifest.slots[b.slot] || {}).draw_order || 0));
      const layers = await Promise.all(chosen.map(item => loadImage(`${equipmentRoot}/${item.path}`)));
      chosen.forEach((item, i) => {
        const offset = item.offset || [0, 0];
        ctx.globalCompositeOperation = item.blend || 'source-over';
        ctx.drawImage(layers[i], Number(offset[0]) || 0, Number(offset[1]) || 0);
      });
      ctx.globalCompositeOperation = 'source-over';
      return canvas;
    };
    return { render, getManifest, loadImage, frameUrl: (a, r, d, anim, frame) => framePath(frameRoot, a, r, d, anim, frame), cacheSize: () => imageCache.size };
  };
  const api = { createRuntime, framePath, RANKS, DIRECTIONS, ANIMATIONS, ARCHETYPES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GBQHDCharacterArt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
