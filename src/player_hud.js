/* GB-Quest player HUD — responsive DOM layer over the legacy game viewport.
 * Reads the live character state; never owns or mutates progression data.
 */
(() => {
  'use strict';
  if (window.GBQPlayerHUD) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const clamp = n => Math.max(0, Math.min(1, Number(n) || 0));
  const pct = (value, max) => Math.round(clamp(Number(value) / Math.max(1, Number(max))) * 100);
  const fmt = n => Math.max(0, Number(n) || 0).toLocaleString();
  const getGame = () => window.GBQ && window.GBQ.G;
  let root, timer, lastSignature = '';
  let mapZoom = 1, latestMapData = null;
  const hudSpriteCache = new Map();
  function hudSpriteData(name) {
    if (hudSpriteCache.has(name)) return hudSpriteCache.get(name);
    const pending = (async () => {
      const indexes = window.GBQ_HD64_INDEXES || {};
      let family = '', rect = null;
      for (const [candidate, sprites] of Object.entries(indexes)) {
        if (sprites && Object.prototype.hasOwnProperty.call(sprites, name)) {
          family = candidate; rect = sprites[name]; break;
        }
      }
      if (!family || !Array.isArray(rect) || rect.length < 5) return null;
      const [page, x, y, width, height] = rect.map(Number);
      if (![page,x,y,width,height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
      const key = family + '_' + page;
      const src = window.GBQ_HD64_ATLASES && window.GBQ_HD64_ATLASES[key] || 'assets_hd64/' + key + '.png';
      const atlas = new Image();
      await new Promise((resolve, reject) => {
        atlas.onload = resolve; atlas.onerror = reject; atlas.src = src;
      });
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.imageSmoothingEnabled = false;
      context.drawImage(atlas, x, y, width, height, 0, 0, width, height);
      return canvas.toDataURL('image/png');
    })().catch(error => { console.warn('HUD sprite unavailable:', name, error); return null; });
    hudSpriteCache.set(name, pending);
    return pending;
  }
  function applyHudSprite(node, name) {
    if (!node || node.dataset.hudArt === name) return;
    node.dataset.hudArt = name;
    hudSpriteData(name).then(src => {
      if (!src || !node.isConnected || node.dataset.hudArt !== name) return;
      let image = node.querySelector('img.gbq-hud-art');
      if (!image) { image = document.createElement('img'); image.className = 'gbq-hud-art'; image.alt = ''; image.setAttribute('aria-hidden','true'); node.appendChild(image); }
      image.src = src;
      node.classList.add('has-art');
    });
  }
  function updateHudArtwork(game, hotbar) {
    const avatar = root && root.querySelector('[data-hud-avatar]');
    const classId = String(game && game.cls || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    if (classId) applyHudSprite(avatar, 'np_class_' + classId);
    root && root.querySelectorAll('.gbq-hud-nav .gbq-hud-glyph').forEach((node, index) => {
      applyHudSprite(node, 'au_menu_icons_' + String(index).padStart(3,'0'));
    });
    if (hotbar) [...hotbar.querySelectorAll('button')].forEach((node, index) => {
      const icon = node.querySelector('span');
      if (icon) applyHudSprite(icon, 'au_skill_icons_' + String(index).padStart(3,'0'));
    });
  }
  const button = (label, key, glyph, extra = '') => `<button class="gbq-hud-nav" type="button" data-hud-action="${key}" ${extra}><span class="gbq-hud-glyph">${glyph}</span><span>${label}</span></button>`;
  function mount() {
    const viewport = document.querySelector('.game-viewport');
    if (!viewport || document.getElementById('gbq-player-hud')) return;
    root = document.createElement('section');
    root.id = 'gbq-player-hud';
    root.className = 'gbq-player-hud';
    root.setAttribute('aria-label', 'Player heads-up display');
    root.innerHTML = `
      <header class="gbq-hud-top">
        <div class="gbq-hud-brand"><span class="gbq-hud-crest" aria-hidden="true"></span><span>GB-QUEST<small>REALM OF SHADOWBANE</small></span></div>
        <div class="gbq-hud-compass" aria-label="Compass"><span>W</span><i></i><b>NW</b><i></i><strong>N</strong><i></i><b>NE</b><i></i><span>E</span></div>
        <div class="gbq-hud-wallet"><span>G <b data-hud-gold>0</b></span><span>GEM <b data-hud-gems>0</b></span></div>
      </header>
      <aside class="gbq-hud-left">
        <section class="gbq-hud-panel gbq-hud-player">
          <div class="gbq-hud-avatar" data-hud-avatar aria-label="Trainer portrait">P</div>
          <div class="gbq-hud-player-info"><div class="gbq-hud-player-name" data-hud-name>Adventurer</div><div class="gbq-hud-level" data-hud-level>LEVEL 1 · WANDERER</div>
            <div class="gbq-hud-meter hp"><span>HP</span><b data-hud-hp-text>0 / 0</b><i><em data-hud-hp></em></i></div>
            <div class="gbq-hud-meter mp"><span>MP</span><b data-hud-mp-text>0 / 0</b><i><em data-hud-mp></em></i></div>
            <div class="gbq-hud-meter xp"><span>XP</span><b data-hud-xp-text>0%</b><i><em data-hud-xp></em></i></div>
          </div>
        </section>
        <section class="gbq-hud-panel gbq-hud-attributes" aria-label="Live character attributes">
          <div class="gbq-hud-section-title">ATTRIBUTES <span>BASE + MOD</span></div>
          <div class="gbq-hud-attribute-grid">
            <div><small>STR</small><strong data-hud-attr="STR">10 <i>+0</i></strong></div>
            <div><small>DEX</small><strong data-hud-attr="DEX">10 <i>+0</i></strong></div>
            <div><small>CON</small><strong data-hud-attr="CON">10 <i>+0</i></strong></div>
            <div><small>INT</small><strong data-hud-attr="INT">10 <i>+0</i></strong></div>
            <div><small>WIS</small><strong data-hud-attr="WIS">10 <i>+0</i></strong></div>
            <div><small>CHA</small><strong data-hud-attr="CHA">10 <i>+0</i></strong></div>
            <div><small>LCK</small><strong data-hud-attr="LCK">10 <i>+0</i></strong></div>
            <div><small>WIL</small><strong data-hud-attr="WIL">10 <i>+0</i></strong></div>
            <div><small>SPD</small><strong data-hud-attr="SPD">10 <i>+0</i></strong></div>
          </div>
        </section>
        <section class="gbq-hud-panel gbq-hud-combat-stats" aria-label="Live combat statistics">
          <div class="gbq-hud-section-title">COMBAT PROFILE <span data-hud-gear-count>0 / 14 GEAR</span></div>
          <div class="gbq-hud-stat-grid">
            <div><small>ARMOR</small><strong data-hud-ac>0</strong></div>
            <div><small>WEAPON DMG</small><strong data-hud-attack>1d1</strong></div>
            <div><small>HIT BONUS</small><strong data-hud-hit>0</strong></div>
            <div><small>AVG ITEM LVL</small><strong data-hud-ilvl>0</strong></div>
          </div>
        </section>
                <section class="gbq-hud-panel gbq-hud-party"><div class="gbq-hud-section-title">PARTY <span data-hud-party-count>1 / 4</span></div><div data-hud-party-list></div></section>
      </aside>
      <aside class="gbq-hud-right">
        <section class="gbq-hud-panel gbq-hud-map"><div class="gbq-hud-map-tools"><span>LOCAL MAP</span><button type="button" data-map-zoom="out" aria-label="Zoom out">−</button><button type="button" data-map-zoom="in" aria-label="Zoom in">+</button><button type="button" data-map-zoom="center" aria-label="Center on player">◎</button></div><canvas class="gbq-hud-map-art" data-hud-minimap width="180" height="112" aria-label="Interactive local map; click a marker to inspect it"></canvas><div class="gbq-hud-map-meta"><strong data-hud-zone>THE FRONTIER</strong><span data-hud-coords>X: 0 · Y: 0</span></div></section>
        <section class="gbq-hud-panel gbq-hud-quests"><div class="gbq-hud-section-title">QUESTS <span>^</span></div><div data-hud-quests><div class="gbq-hud-quest"><b>*</b><span><strong>Explore the Realm</strong><small>Continue your journey</small></span></div></div></section>
      </aside>
      <div class="gbq-hud-bottom">
        <div class="gbq-hud-shortcuts">
          ${button('Character','character','C')} ${button('Inventory','inventory','B')} ${button('Skills','skills','M')} ${button('Talents','talents','T')} ${button('Crafting','crafting','C')}
        </div>
        <div class="gbq-hud-action-area"><div class="gbq-hud-quick"><button type="button" data-hud-action="quick1">Q</button><button type="button" data-hud-action="quick2">E</button></div><div class="gbq-hud-hotbar" data-hud-hotbar></div><div class="gbq-hud-potions"><button type="button" data-hud-action="potion">HP <small data-hud-potions>0</small></button><button type="button" data-hud-action="mana">MP</button></div></div>
        <div class="gbq-hud-shortcuts gbq-hud-shortcuts-right">
          ${button('Map','map','M')} ${button('Journal','journal','J')} ${button('Guild','guild','G')} ${button('Market','market','$')} ${button('Collection','collection','C')}
        </div>
      </div>
      <div class="gbq-hud-toast" role="status" aria-live="polite"></div>`;
    viewport.appendChild(root);
    root.addEventListener('click', onAction);
    root.querySelector('[data-hud-minimap]').addEventListener('click', onMapClick);
    update();
    timer = window.setInterval(update, 350);
  }
  function onAction(event) {
    const zoomTarget = event.target.closest('[data-map-zoom]');
    if (zoomTarget) { const mode=zoomTarget.dataset.mapZoom; mapZoom=mode==='center'?1:Math.max(1,Math.min(5,mapZoom+(mode==='in'?1:-1))); drawMiniMap(latestMapData); return; }
    const target = event.target.closest('[data-hud-action]');
    if (!target) return;
    const action = target.dataset.hudAction, api = window.GBQ;
    if (/^slot[1-8]$/.test(action)) {
      const combat = window.GBQCombatHotbar, index = Number(action.slice(4)) - 1;
      const entries = combat && typeof combat.entries === 'function' ? combat.entries() : [];
      if (combat && typeof combat.use === 'function' && entries.length > index) {
        combat.use(index);
        return;
      }
      showToast('Combat abilities are available during battle');
      return;
    }
    const sceneMap = {
      character: () => typeof CharacterMenu === 'function' ? new CharacterMenu() : null,
      inventory: () => typeof BagScene === 'function' ? new BagScene() : typeof InventoryScene === 'function' ? new InventoryScene() : null,
      skills: () => typeof ArtsScene === 'function' ? new ArtsScene() : typeof AbilitySkillsScene === 'function' ? new AbilitySkillsScene() : null,
      talents: () => typeof GrowthScene === 'function' ? new GrowthScene() : typeof TalentScene === 'function' ? new TalentScene() : null,
      crafting: () => typeof CraftScene === 'function' ? new CraftScene() : null,
      journal: () => typeof QuestLog === 'function' ? new QuestLog() : null,
      guild: () => typeof SocialScene === 'function' ? new SocialScene() : null,
      market: () => typeof AuctionHouse === 'function' ? new AuctionHouse() : null,
      collection: () => typeof AchievementScene === 'function' ? new AchievementScene() : null
    };
    if (action === 'map' && api && typeof api.openAtlas === 'function') { api.openAtlas(); return; }
    if (action === 'chat') { document.getElementById('chatShow')?.click(); return; }
    if (sceneMap[action] && api && typeof api.push === 'function') {
      try {
        const scene = sceneMap[action]();
        if (scene) { api.push(scene); return; }
      } catch (error) {
        console.warn('HUD navigation action failed:', action, error);
        showToast('That menu is unavailable right now');
        return;
      }
    }
    const toast = root.querySelector('.gbq-hud-toast');
    const messages = {quick1:'Quick skill slot Q',quick2:'Quick skill slot E',potion:'Potion slot R',mana:'Mana potion slot F'};
    if (toast) { toast.textContent = messages[action] || 'Open the game menu with Enter'; toast.classList.add('show'); window.setTimeout(() => toast.classList.remove('show'), 1800); }
    if (action === 'potion' && api && typeof api.G === 'object') window.dispatchEvent(new KeyboardEvent('keydown', {key:'r', bubbles:true}));
  }
  function showToast(message) { const toast = root && root.querySelector('.gbq-hud-toast'); if (!toast) return; toast.textContent = message; toast.classList.add('show'); window.setTimeout(() => toast.classList.remove('show'), 1800); }
  function drawMiniMap(data) {
    const canvas = root && root.querySelector('[data-hud-minimap]'); if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return; const w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h); ctx.fillStyle='#17232a'; ctx.fillRect(0,0,w,h);
    if (!data || !Array.isArray(data.rows) || !data.rows.length) { ctx.fillStyle='#d7c58b';ctx.font='11px sans-serif';ctx.fillText('MAP DATA UNAVAILABLE',8,18);return; }
    const cols=Math.max(1,data.width||1), totalRows=data.rows.length, tileW=w/cols, tileH=h/totalRows;
    const viewCols=Math.max(1,cols/mapZoom), viewRows=Math.max(1,totalRows/mapZoom);
    const left=Math.max(0,Math.min(cols-viewCols,(Number(data.x)||0)+.5-viewCols/2));
    const top=Math.max(0,Math.min(totalRows-viewRows,(Number(data.y)||0)+.5-viewRows/2));
    const sx=w/viewCols,sy=h/viewRows;
    const colors={'.':'#73875b',',':'#607b4f','~':'#315d78','w':'#315d78','W':'#315d78','^':'#7a7770','m':'#68715a','f':'#426044','T':'#36563c','#':'#8b8067','d':'#9b8058','s':'#8e815e','L':'#b19a68','+':'#8d7651'};
    const x0=Math.floor(left),y0=Math.floor(top),x1=Math.ceil(left+viewCols),y1=Math.ceil(top+viewRows);
    for(let y=y0;y<Math.min(totalRows,y1);y++){const line=String(data.rows[y]||'');for(let x=x0;x<Math.min(cols,x1,line.length);x++){ctx.fillStyle=colors[line[x]]||(/[0-9A-Z]/.test(line[x])?'#64745b':'#657b58');ctx.fillRect((x-left)*sx,(y-top)*sy,Math.ceil(sx+.3),Math.ceil(sy+.3));}}
    (data.entities||[]).forEach(e=>{if(e.x<left||e.x>=left+viewCols||e.y<top||e.y>=top+viewRows)return;ctx.fillStyle=e.kind==='npc'||e.kind==='peer'?'#6fd3d1':e.kind==='pull'||e.kind==='boss'?'#e76b55':e.kind==='waypoint'?'#c18bff':'#e4c16f';ctx.beginPath();ctx.arc((e.x+.5-left)*sx,(e.y+.5-top)*sy,Math.max(2,Math.min(4,sx*.22)),0,Math.PI*2);ctx.fill();});
    ctx.fillStyle='#ffe28a';ctx.strokeStyle='#25180d';ctx.lineWidth=2;ctx.beginPath();ctx.arc((data.x+.5-left)*sx,(data.y+.5-top)*sy,Math.max(3,Math.min(5,sx*.28)),0,Math.PI*2);ctx.fill();ctx.stroke();
    canvas.dataset.viewLeft=String(left);canvas.dataset.viewTop=String(top);canvas.dataset.viewCols=String(viewCols);canvas.dataset.viewRows=String(viewRows);
  }
  function onMapClick(event) {
    const canvas=event.currentTarget,rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*canvas.width,y=(event.clientY-rect.top)/rect.height*canvas.height;
    const left=Number(canvas.dataset.viewLeft||0),top=Number(canvas.dataset.viewTop||0),viewCols=Number(canvas.dataset.viewCols||1),viewRows=Number(canvas.dataset.viewRows||1);
    const tileX=Math.floor(left+x/canvas.width*viewCols),tileY=Math.floor(top+y/canvas.height*viewRows);
    const marker=(latestMapData?.entities||[]).find(e=>e.x===tileX&&e.y===tileY);
    showToast(marker?' '+String(marker.name||marker.kind)+' · '+tileX+','+tileY:'Map tile '+tileX+', '+tileY);
  }
  function update() {
    if (!root || !root.isConnected) { if (timer) window.clearInterval(timer); timer = null; return; }
    const g = getGame();
    const stack = window.GBQ && window.GBQ.scenes;
    const activeScene = Array.isArray(stack) && stack.length ? stack[stack.length - 1] : null;
    const onField = !!(activeScene && activeScene.constructor && activeScene.constructor.name === 'Field');
    if (!g || !onField) { root.classList.remove('is-live'); return; }
    root.classList.add('is-live');
    const derived = typeof window.derive === 'function' ? window.derive(g) : {};
    const hpMax = Number(derived.hpMax || g.hpMax || g.hp || 1), mpMax = Number(derived.mpMax || g.mpMax || g.mp || 1);
    const hp = Number(g.hp || 0), mp = Number(g.mp ?? g.mana ?? 0), level = Number(g.lvl || g.level || 1);
    const xpCurrent = Number(g.xp || 0);
    const xpFloor = typeof window.xpForLevel === 'function' ? Number(window.xpForLevel(level)) || 0 : 0;
    const xpNext = typeof window.xpForLevel === 'function' ? Number(window.xpForLevel(Math.min(99, level + 1))) || xpFloor + 1 : xpFloor + 1;
    const xpPct = level >= 99 ? 100 : pct(xpCurrent - xpFloor, Math.max(1, xpNext - xpFloor));
    const setText = (selector, value) => { const node = root.querySelector(selector); if (node) node.textContent = value; };
    const setBar = (selector, value) => { const node = root.querySelector(selector); if (node) node.style.width = value + '%'; };
    setText('[data-hud-name]', g.name || 'Adventurer');
    setText('[data-hud-level]', 'LEVEL ' + level + ' · ' + String(g.cls || 'ADVENTURER').replace(/[-_]/g,' ').toUpperCase());
    setText('[data-hud-hp-text]', fmt(hp) + ' / ' + fmt(hpMax)); setBar('[data-hud-hp]', pct(hp,hpMax));
    setText('[data-hud-mp-text]', fmt(mp) + ' / ' + fmt(mpMax)); setBar('[data-hud-mp]', pct(mp,mpMax));
    setText('[data-hud-xp-text]', xpPct + '%'); setBar('[data-hud-xp]', xpPct);
    const equipped = g.eq && typeof g.eq === 'object' ? Object.values(g.eq).filter(Boolean) : [];
    const gearLevels = equipped.map(item => Number(item?.ilvl) || 0).filter(value => value > 0);
    const averageItemLevel = gearLevels.length ? Math.round(gearLevels.reduce((sum, value) => sum + value, 0) / gearLevels.length) : 0;
    const weaponDice = String(derived.weapon?.dice || '1d1');
    const weaponModifier = Number(derived.weapon?.dmg) || 0;
    const weaponDamage = weaponModifier > 0 ? weaponDice + ' + ' + weaponModifier
      : weaponModifier < 0 ? weaponDice + ' − ' + Math.abs(weaponModifier) : weaponDice;
    const attributes = derived.A && typeof derived.A === 'object' ? derived.A : (g.base || {});
    const modifiers = derived.M && typeof derived.M === 'object' ? derived.M : {};
    root.querySelectorAll('[data-hud-attr]').forEach(node => {
      const key = node.dataset.hudAttr;
      const score = Number(attributes[key] ?? 10);
      const modifier = Number(modifiers[key] ?? Math.floor((score - 10) / 2));
      const sign = modifier > 0 ? '+' : '';
      node.innerHTML = esc(fmt(score)) + ' <i>' + esc(sign + modifier) + '</i>';
    });
    setText('[data-hud-ac]', fmt(derived.ac || 0));
    setText('[data-hud-attack]', weaponDamage);
    setText('[data-hud-hit]', (Number(derived.weapon?.hit) > 0 ? '+' : '') + fmt(derived.weapon?.hit || 0));
    setText('[data-hud-ilvl]', fmt(averageItemLevel));
    setText('[data-hud-gear-count]', equipped.length + ' / 14 GEAR');
    setText('[data-hud-gold]', fmt(g.gold)); setText('[data-hud-gems]', fmt(g.gems || g.crystals || 0));
    const mapData = typeof window.GBQWorldMapMini === 'function' ? window.GBQWorldMapMini() : null;
    latestMapData = mapData;
    setText('[data-hud-zone]', String(mapData?.zone || g.map || 'THE FRONTIER').replace(/[-_]/g,' ').toUpperCase());
    setText('[data-hud-coords]', 'X: ' + Math.round(mapData?.x ?? g.x ?? 0) + ' · Y: ' + Math.round(mapData?.y ?? g.y ?? 0));
    drawMiniMap(mapData);
    setText('[data-hud-potions]', fmt(g.inv && (g.inv.potion || g.inv.health_potion) || 0));
    const companions = Array.isArray(g.companions) ? g.companions.filter(Boolean).slice(0,3) : [];
    setText('[data-hud-party-count]', (companions.length + 1) + ' / 4');
    const party = [{name:g.name || 'You',hp,max:hpMax,cls:g.cls || 'Hero'}, ...companions.map(c=>({name:c.name || 'Ally',hp:Number(c.hp||0),max:Number((typeof window.derive==='function' && window.derive(c).hpMax)||c.hpMax||c.hp||1),cls:c.cls||'Companion'}))];
    const partyNode = root.querySelector('[data-hud-party-list]');
    if (partyNode) partyNode.innerHTML = party.map((p,i)=>`<div class="gbq-hud-party-member"><span class="gbq-hud-party-icon">${i+1}</span><span class="gbq-hud-party-data"><b>${esc(p.name)}</b><small>${esc(p.cls)}</small><i><em style="width:${pct(p.hp,p.max)}%"></em></i></span><strong>${Math.round(p.hp/p.max*100)}%</strong></div>`).join('');
    const questSource = Array.isArray(g.quests) ? g.quests : Array.isArray(g.activeQuests) ? g.activeQuests : [];
    const quests = questSource.filter(q => q && (q.active !== false) && !q.done && !q.completed);
    const questNode = root.querySelector('[data-hud-quests]');
    if (questNode) questNode.innerHTML = quests.length ? quests.slice(0,3).map((q,i)=>`<div class="gbq-hud-quest"><b>${i===0?'*':'>'}</b><span><strong>${esc(q.name || q.title || 'Active Quest')}</strong><small>${esc(q.objective || q.description || q.progressText || 'Quest in progress')}</small></span></div>`).join('') : '<div class="gbq-hud-quest"><b>*</b><span><strong>Explore the Realm</strong><small>Open Journal to review your quests</small></span></div>';
    const combatEntries = window.GBQCombatHotbar && typeof window.GBQCombatHotbar.entries === 'function' ? window.GBQCombatHotbar.entries() : [];
    const arts = combatEntries.length ? combatEntries : (Array.isArray(g.arts) ? g.arts : Array.isArray(g.skills) ? g.skills : []);
    const hotbar = root.querySelector('[data-hud-hotbar]');
    if (hotbar) {
      const markup = Array.from({length:8},(_,i)=>{
        const a=arts[i], remaining=Number(a?.remaining||0), cooling=remaining>0;
        const blocked=(a && a.ok===false)||cooling||!!a?.paused;
        const label=cooling?Math.ceil(remaining/60)+'s':a?.paused?'PAUSE':'';
        const name=a && (a.name || a.id) || 'Action slot '+(i+1);
        const status=cooling?' · Cooldown '+label:a?.paused?' · Paused':blocked?' · Unavailable':'';
        return '<button type="button" data-hud-action="slot'+(i+1)+'" aria-label="'+esc(name+status)+'" '+(blocked?'disabled':'')+' title="'+esc(name+status)+'"><span>'+(a?'A':'+')+'</span>'+(cooling?'<i class="gbq-hud-cooldown" aria-hidden="true">'+label+'</i>':'')+'<small>'+(i+1)+'</small></button>';
      }).join('');
      if (hotbar.dataset.renderedMarkup !== markup) {
        const focusedAction = hotbar.contains(document.activeElement) ? document.activeElement.dataset.hudAction : '';
        const focusHadHotbar = hotbar.contains(document.activeElement);
        hotbar.innerHTML = markup;
        hotbar.dataset.renderedMarkup = markup;
        if (focusHadHotbar && focusedAction) {
          const buttons = [...hotbar.querySelectorAll('button:not(:disabled)')];
          const same = hotbar.querySelector('[data-hud-action="'+focusedAction+'"]:not(:disabled)');
          const focusedIndex = Number(focusedAction.slice(4)) - 1;
          const next = same || buttons.find(button => Number(button.dataset.hudAction.slice(4)) - 1 >= focusedIndex) || buttons[buttons.length-1];
          next?.focus({preventScroll:true});
        }
      }
    }
    updateHudArtwork(g, hotbar);
    const signature = [g.name,level,hp,mp,g.gold,g.map,g.x,g.y,companions.length,quests.length,arts.length,mapData?.x,mapData?.y].join('|');
    if (signature !== lastSignature) { root.dataset.updated = String(Date.now()); lastSignature = signature; }
  }
  function init() { mount(); if (!root) window.setTimeout(init, 250); }
  window.GBQPlayerHUD = { mount:init, refresh:update, destroy(){ if(timer)window.clearInterval(timer);timer=null;root?.remove();root=null; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
