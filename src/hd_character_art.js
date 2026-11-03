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
  const directionForInput = direction => {
    const value = String(direction || 'down').toLowerCase();
    const map = { down: 'S', south: 'S', up: 'N', north: 'N', left: 'W', west: 'W',
      right: 'E', east: 'E', southwest: 'SW', southeast: 'SE', northwest: 'NW', northeast: 'NE' };
    const normalized = map[value] || String(direction || '').toUpperCase();
    return DIRECTIONS.includes(normalized) ? normalized : 'S';
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
  const archetypeForClass = value => {
    const key = String(value || '').toLowerCase();
    const map = { warrior: 'warrior', fighter: 'warrior', barbarian: 'warrior', paladin: 'warrior',
      mage: 'mage', wizard: 'mage', sorcerer: 'mage', ranger: 'ranger', rogue: 'rogue',
      cleric: 'cleric', priest: 'cleric', summoner: 'summoner', warlock: 'summoner', druid: 'summoner', necromancer: 'summoner' };
    return map[key] || 'warrior';
  };
  const fallbackVisual = (slot, base) => {
    const id = String(base || '').toLowerCase();
    if (slot === 'weapon') {
      if (/dagger|knife|shiv/.test(id)) return { slot: 'main_hand', visualItemId: 'paired_daggers' };
      if (/bow|crossbow|blowgun|sling/.test(id)) return { slot: 'main_hand', visualItemId: 'short_bow' };
      if (/staff|wand|grimoire|codex|tome/.test(id)) return { slot: 'main_hand', visualItemId: 'oak_staff' };
      if (/mace|hammer|club|maul|flail/.test(id)) return { slot: 'main_hand', visualItemId: 'holy_mace' };
      return { slot: 'main_hand', visualItemId: 'iron_sword' };
    }
    if (slot === 'offhand') return { slot: 'off_hand', visualItemId: 'iron_shield' };
    if (/robe|vestment|mantle|silk/.test(id)) return { slot: 'chest', visualItemId: 'arcane_robe' };
    if (/leather|hide|padded/.test(id)) return { slot: 'chest', visualItemId: 'shadow_leathers' };
    return { slot: 'chest', visualItemId: 'iron_plate' };
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
      const record = records.find(entry => entry.catalogId === catalogId) || fallbackVisual(key, look.base);
      if (record && record.slot === slots[key] && record.visualItemId) result[record.slot] = record.visualItemId;
    }
    return { archetype: safe(character && character.archetype, ARCHETYPES) || archetypeForClass(character && character.cls),
      rank: safe(rank, RANKS) || 'F', equipment: result };
  };
  const createFramePresenter = runtime => {
    if (!runtime || typeof runtime.renderCharacter !== 'function') throw new TypeError('HD character runtime is required');
    let requestedKey = null, readyKey = null, readyCanvas = null, generation = 0;
    const request = (character, spec = {}) => {
      const key = JSON.stringify([
        character && (character.id || character.name || character.cls),
        character && character.rank, character && character.eq,
        spec.direction, spec.frame, spec.state, spec.action, spec.animation,
        spec.rank, spec.archetype, spec.ghost
      ]);
      if (key !== requestedKey) {
        requestedKey = key;
        const token = ++generation;
        runtime.renderCharacter(character, spec).then(canvas => {
          if (token !== generation) return;
          readyKey = key;
          readyCanvas = canvas;
        }).catch(() => {
          if (token === generation) requestedKey = null;
        });
      }
      return readyKey === key ? readyCanvas : null;
    };
    const clear = () => { generation++; requestedKey = null; readyKey = null; readyCanvas = null; };
    return { request, clear, getReady: () => readyCanvas };
  };
  const createRuntime = (options = {}) => {
    const frameRoot = options.frameRoot || 'assets_hd64/animations/frames';
    const equipmentRoot = options.equipmentRoot || 'assets_hd64/equipment';
    const manifestUrl = options.manifestUrl || `${equipmentRoot}/equipment_manifest.json`;
    const visualMapUrl = options.visualMapUrl || 'data/visuals/equipment-catalog-visual-map.json';
    const imageCache = new Map();
    const compositeCache = new Map();
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
        direction: directionForInput(spec.direction), animation: spec.animation || animationForState(spec.state || spec.action),
        rank: resolved.rank, equipment: { ...resolved.equipment, ...(spec.equipment || {}) }
      });
    };
    const render = spec => {
      if (!spec) return Promise.reject(new TypeError('Character render specification is required'));
      const frame = Number(spec.frame || 0);
      const baseUrl = framePath(frameRoot, spec.archetype, spec.rank, spec.direction, spec.animation, frame);
      if (!baseUrl) return Promise.reject(new TypeError('Invalid archetype, rank, direction, animation, or frame'));
      const equipmentKey = Object.keys(spec.equipment || {}).sort().map(key => [key, spec.equipment[key]]);
      const key = JSON.stringify([baseUrl, equipmentKey]);
      if (compositeCache.has(key)) return compositeCache.get(key);
      const pending = (async () => {
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
      })();
      compositeCache.set(key, pending);
      pending.catch(() => { if (compositeCache.get(key) === pending) compositeCache.delete(key); });
      return pending;
    };
    return { render, renderCharacter, getManifest, getVisualMap, loadImage, frameUrl: (a, r, d, anim, frame) => framePath(frameRoot, a, r, d, anim, frame), cacheSize: () => imageCache.size, compositeCacheSize: () => compositeCache.size };
  };
  const api = { createRuntime, createFramePresenter, framePath, directionForInput, animationForState, archetypeForClass, fallbackVisual, resolveEquipment, RANKS, DIRECTIONS, ANIMATIONS, ARCHETYPES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GBQHDCharacterArt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
