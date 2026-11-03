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
    return `${String(base).replace(/\/$/, '')}/${archetype}/${rank}/${direction}/${animation}/frame_${String(index).padStart(3, '0')}.png`;
  };
  const animationForState = state => {
    const value = String(state || 'idle').toLowerCase();
    if (['dead', 'death', 'dying'].includes(value)) return 'death';
    if (['cast', 'casting', 'channel', 'channeling'].includes(value)) return 'cast';
    if (['attack', 'attacking', 'melee', 'ranged'].includes(value)) return 'attack';
    if (['block', 'blocking', 'guard'].includes(value)) return 'block';
    if (['hit', 'hurt', 'stagger'].includes(value)) return 'hit';
    if (['run', 'running', 'sprint'].includes(value)) return 'run';
    if (['walk', 'walking', 'move', 'moving'].includes(value)) return 'walk';
    return 'idle';
  };
  const resolveEquipment = (character, visualMap, rank = 'F') => {
    const records = Array.isArray(visualMap && visualMap.records) ? visualMap.records : [];
    const result = {};
    const slots = { weapon: 'main_hand', armor: 'chest', offhand: 'off_hand' };
    const eq = character && character.eq || {};
    for (const key of Object.keys(slots)) {
      const equipped = eq[key];
      if (!equipped || !equipped.kind || !equipped.base) continue;
      const look = equipped.tmog && equipped.tmog.kind && equipped.tmog.base ? equipped.tmog : equipped;
      const catalogId = `${look.kind}:${look.base}`;
      const record = records.find(entry => entry.catalogId === catalogId);
      if (record && record.slot === slots[key] && record.visualItemId) result[record.slot] = record.visualItemId;
    }
    return { archetype: safe(character && character.archetype, ARCHETYPES) || safe(character && character.cls, ARCHETYPES) || 'warrior',
      rank: safe(rank, RANKS) || 'F', equipment: result };
  };
  const createRuntime = (options = {}) => {
    const frameRoot = options.frameRoot || 'assets_hd64/animations/frames';
    const equipmentRoot = options.equipmentRoot || 'assets_hd64/equipment';
    const manifestUrl = options.manifestUrl || `${equipmentRoot}/equipment_manifest.json`;
    const visualMapUrl = options.visualMapUrl || 'data/visuals/equipment-catalog-visual-map.json';
    const imageCache = new Map();
    let manifestPromise = null;
    let visualMapPromise = null;
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
    const getVisualMap = () => {
      if (!visualMapPromise) {
        visualMapPromise = typeof fetch === 'function'
          ? fetch(visualMapUrl).then(r => { if (!r.ok) throw new Error(`Equipment visual map HTTP ${r.status}`); return r.json(); })
          : Promise.reject(new Error('Fetch API unavailable'));
      }
      return visualMapPromise;
    };
    const getManifest = () => {
      if (!manifestPromise) {
        manifestPromise = typeof fetch === 'function'
          ? fetch(manifestUrl).then(r => { if (!r.ok) throw new Error(`Equipment manifest HTTP ${r.status}`); return r.json(); })
          : Promise.reject(new Error('Fetch API unavailable'));
      }
      return manifestPromise;
    };
    const renderCharacter = async (character, spec = {}) => {
      const [visualMap] = await Promise.all([getVisualMap()]);
      const resolved = resolveEquipment(character, visualMap, spec.rank || character && character.rank || 'F');
      return render({
        ...spec, archetype: spec.archetype || resolved.archetype,
        rank: resolved.rank, equipment: { ...resolved.equipment, ...(spec.equipment || {}) }
      });
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
    return { render, renderCharacter, getManifest, getVisualMap, loadImage, frameUrl: (a, r, d, anim, frame) => framePath(frameRoot, a, r, d, anim, frame), cacheSize: () => imageCache.size };
  };
  const api = { createRuntime, framePath, animationForState, resolveEquipment, RANKS, DIRECTIONS, ANIMATIONS, ARCHETYPES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GBQHDCharacterArt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
