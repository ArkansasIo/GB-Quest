'use strict';
// ================================================================ INVENTORY, STASH, EQUIPMENT (Diablo-style)
// Inventory: grid of 8x5 cells, tabs GEAR / USE / MATS / QUEST; rarity-coloured cells, upgrade arrows,
// junk + favourite marks, tooltip that compares with what you wear, sort, sell / salvage all junk,
// a full COMPARE screen, and UPGRADE (temper +1) with salvage materials.
// Stash: 4 tabs x 40 cells (tabs 3-4 bought with gold), quick-move between bag and stash.
// Equipment: paper doll, 6 slots each side of the hero (12 slots).

Object.assign(ITEMS, {
  scrap: { name: 'SCRAP IRON', icon: 'ne_ore_0', type: 'mat', price: 2, desc: 'Salvaged from common gear. Upgrades items.' },
  shard: { name: 'GLIMMER SHARD', icon: 'ne_gem_1', type: 'mat', price: 12, desc: 'Salvaged from rare gear. Upgrades rare+ items.' },
  ember: { name: 'EMBER SOUL', icon: 'ne_relic_1', type: 'mat', price: 60, desc: 'Salvaged from legendary gear. Upgrades legendaries.' },
});
const INV_COLS = 8, INV_ROWS = 5, STASH_TABS = 4, STASH_SIZE = INV_COLS * INV_ROWS, STASH_COST = [0, 0, 2000, 10000];
const STASH_TAB_NAMES = ['GENERAL', 'GEAR', 'MATERIALS', 'CONSUMABLES'];
const STASH_TAB_LABELS = { GENERAL: 'GEN', GEAR: 'GEAR', MATERIALS: 'MATS', CONSUMABLES: 'USE' };
const INV_TABS = [['GEAR', null], ['USE', ['use', 'scroll', 'camp', 'hearth']], ['MATS', ['mat']], ['QUEST', ['junk', 'key']]];
const MAX_PLUS = [0, 1, 2, 3, 4, 5]; // upgrade cap by rarity

function stashOf() {
  if (!G.stash || typeof G.stash !== 'object') G.stash = { tabs: Array.from({ length: STASH_TABS }, () => []), unlocked: 2 };
  G.stash.tabs = Array.from({ length: STASH_TABS }, (_, i) => Array.isArray(G.stash.tabs && G.stash.tabs[i]) ? G.stash.tabs[i] : []);
  G.stash.unlocked = Math.max(1, Math.min(STASH_TABS, Math.floor(Number(G.stash.unlocked) || 2)));
  G.stash.names = Array.from({ length: STASH_TABS }, (_, i) => {
    const name = String(G.stash.names && G.stash.names[i] || STASH_TAB_NAMES[i]).trim().toUpperCase();
    return name.replace(/[^A-Z0-9 ]/g, '').slice(0, 10) || STASH_TAB_NAMES[i];
  });
  if (Array.isArray(G.bank) && G.bank.length) {
    const legacy = G.bank.splice(0);
    for (const item of legacy) {
      let target = G.stash.tabs.slice(0, G.stash.unlocked).find(tab => tab.length < STASH_SIZE);
      if (!target && G.stash.unlocked < STASH_TABS) target = G.stash.tabs[G.stash.unlocked++];
      if (target) target.push(item);
      else { G.mail ||= []; G.mail.push({ from: 'BANK VAULT', text: 'Your old bank was full. An item was mailed safely.', item }); }
    }
  }
  return G.stash;
}
// main stat line for an item, and the change against what is equipped in its slot
function itemPower(c, it) {
  if (!it) return 0;
  return itemScore(c, it);
}
function itemKeyStat(it) {
  if (it.kind === 'weapon') { const w = WEAPONS[it.base]; return `${w.dmg} ${w.type.slice(0, 4).toUpperCase()}${it.plus > 0 ? '+' + it.plus : ''}`; }
  if (it.kind === 'armor') { const a = ARMORS[it.base]; return a.type === 'shield' ? `AC+${2 + Math.max(0, it.plus)}` : `AC ${a.ac + Math.max(0, it.plus)}`; }
  const w = WONDROUS.find(x => x.id === it.base); return `${(w ? w.bonus : '?').toUpperCase()} +${Math.max(1, it.plus)}`;
}
function equippedFor(c, it) { const s = slotsFor(it); return s.map(x => c.eq[x]).filter(Boolean).sort((a, b) => itemPower(c, a) - itemPower(c, b))[0] || null; }
function compareDelta(c, it) {
  const cur = equippedFor(c, it); if (!cur) return { cur: null, d: null };
  // real stat deltas: equip on a copy and derive
  const before = derive(c), copy = JSON.parse(JSON.stringify({ ...c, bag: [], companions: undefined }));
  const slot = slotsFor(it).find(s => c.eq[s] === cur) || slotsFor(it)[0]; copy.eq[slot] = it;
  const after = derive(copy);
  return { cur, d: { ac: after.ac - before.ac, hp: after.hpMax - before.hpMax, hit: after.weapon.hit - before.weapon.hit, dmg: diceAvg(after.weapon.dice) + after.weapon.dmg - diceAvg(before.weapon.dice) - before.weapon.dmg, init: after.init - before.init } };
}
const salvageYield = it => it.rarity >= 5 ? { ember: 1, shard: 2, scrap: 4 } : it.rarity >= 3 ? { shard: 1, scrap: 2 + (it.rarity - 3) } : { scrap: 1 + it.rarity };
const upgradeCost = it => { const n = Math.max(0, it.plus) + 1; return { scrap: 3 * n, shard: it.rarity >= 3 ? n : 0, ember: it.rarity >= 5 ? Math.max(0, n - 3) : 0, gold: 50 * n * Math.max(1, Math.floor(it.ilvl / 5)) }; };
function canAfford(cost) { return (G.inv.scrap || 0) >= cost.scrap && (G.inv.shard || 0) >= cost.shard && (G.inv.ember || 0) >= cost.ember && G.gold >= cost.gold; }
function salvage(it) { const y = salvageYield(it); for (const k in y) addItem(k, y[k]); const i = G.bag.indexOf(it); if (i >= 0) G.bag.splice(i, 1); return y; }
const yieldText = y => Object.entries(y).map(([k, v]) => `${v} ${ITEMS[k].name}`).join(', ');

// ---------------------------------------------------------------- shared grid drawing
function drawItemCell(it, x, y, sel, opts = {}) {
  const S = 18;
  fill(x, y, S, S, sel ? 'gold' : 3);
  fill(x + 1, y + 1, S - 2, S - 2, it ? rarityCol(it.rarity === undefined ? 1 : it.rarity) : 1);
  fill(x + 2, y + 2, S - 4, S - 4, 0);
  if (!it) return;
  const icon = opts.icon || itemIcon(it); if (icon) blit(sprFit(icon, 13), x + 3, y + 3);
  if (opts.count != null) textR(String(opts.count), x + S - 1, y + 10, 3);
  if (it.junk) text('x', x + 2, y + 1, 'red');
  if (it.fav) text('*', x + 2, y + 1, 'gold');
  if (opts.up) text('^', x + 12, y + 1, 'green');
}

// ---------------------------------------------------------------- INVENTORY
class InventoryScene {
  constructor(mode) { this.opaque = true; this.mode = mode || 'field'; this.tab = 0; this.cx = 0; this.cy = 0; this.msg = null; this.mt = 0; this.sort = 'rarity'; }
  list() {
    if (this.tab === 0) return G.bag;
    const want = INV_TABS[this.tab][1];
    return Object.keys(G.inv).filter(k => ITEMS[k] && want.includes(ITEMS[k].type) && G.inv[k] > 0);
  }
  cur() { return this.list()[this.cy * INV_COLS + this.cx]; }
  flash(m) { this.msg = m; this.mt = 150; }
  sortBag(how) {
    this.sort = how;
    const key = { rarity: (a, b) => (b.fav | 0) - (a.fav | 0) || b.rarity - a.rarity || b.ilvl - a.ilvl, slot: (a, b) => SLOTS.indexOf(itemSlot(a)) - SLOTS.indexOf(itemSlot(b)) || b.rarity - a.rarity, level: (a, b) => b.ilvl - a.ilvl || b.rarity - a.rarity }[how];
    G.bag.sort(key); SFX.page(); this.flash('SORTED BY ' + how.toUpperCase());
  }
  update() {
    if (this.mt > 0 && --this.mt === 0) this.msg = null;
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('select')) { this.tab = (this.tab + 1) % INV_TABS.length; this.cx = this.cy = 0; SFX.page(); return; }
    if (nav('left')) { this.cx = (this.cx + INV_COLS - 1) % INV_COLS; SFX.cursor(); }
    if (nav('right')) { this.cx = (this.cx + 1) % INV_COLS; SFX.cursor(); }
    if (nav('up')) { this.cy = (this.cy + INV_ROWS - 1) % INV_ROWS; SFX.cursor(); }
    if (nav('down')) { this.cy = (this.cy + 1) % INV_ROWS; SFX.cursor(); }
    if (P('start')) return this.bagMenu();
    if (!P('a')) return;
    const e = this.cur(); if (!e) { SFX.error(); return; }
    this.tab === 0 ? this.gearMenu(e) : this.useMenu(e);
  }
  bagMenu() {
    const junk = G.bag.filter(it => it.junk);
    const sellVal = junk.reduce((a, it) => a + it.value, 0);
    choose(['SORT: RARITY', 'SORT: SLOT', 'SORT: LEVEL', `SELL ALL JUNK (${junk.length}) ${sellVal}G`, `SALVAGE ALL JUNK (${junk.length})`, 'MARK POOR+COMMON AS JUNK', 'BACK'], k => {
      if (k === 0) this.sortBag('rarity'); if (k === 1) this.sortBag('slot'); if (k === 2) this.sortBag('level');
      if (k === 3) { if (!junk.length) return this.flash('NO JUNK MARKED'); junk.forEach(it => G.bag.splice(G.bag.indexOf(it), 1)); G.gold += sellVal; SFX.sell(); this.flash(`SOLD ${junk.length} FOR ${sellVal} G`); }
      if (k === 4) { if (!junk.length) return this.flash('NO JUNK MARKED'); const tot = {}; junk.forEach(it => { const y = salvage(it); for (const q in y) tot[q] = (tot[q] || 0) + y[q]; }); SFX.craft(); say(['Salvaged ' + junk.length + ' items:', yieldText(tot)]); }
      if (k === 5) { let n = 0; G.bag.forEach(it => { if (!it.fav && it.rarity <= 1) { it.junk = true; n++; } }); SFX.toggle(); this.flash(`${n} ITEMS MARKED JUNK`); }
    }, `BAG ${G.bag.length}/${BAG_MAX}  GOLD ${G.gold}`);
  }
  gearMenu(e) {
    if (this.mode === 'sell') { if (e.fav) return this.flash('UNFAVOURITE IT FIRST'); G.bag.splice(G.bag.indexOf(e), 1); G.gold += e.value; SFX.sell(); return this.flash(`SOLD FOR ${e.value} G`); }
    const cost = upgradeCost(e), cap = MAX_PLUS[e.rarity], canUp = e.plus < cap;
    const opts = [...(window.GBQGems && ['weapon', 'armor'].includes(e.kind) ? ['SOCKET GEMS'] : []), ...(window.GBQRunes && ['weapon', 'armor'].includes(e.kind) ? ['RUNE FORGE'] : []), 'EQUIP', 'COMPARE', e.junk ? 'UNMARK JUNK' : 'MARK AS JUNK', e.fav ? 'UNFAVOURITE' : 'FAVOURITE', canUp ? `UPGRADE TO +${e.plus + 1}` : 'UPGRADE (MAX)', `SALVAGE`, `SELL ${e.value}G`, 'LIST ON AUCTION', 'BACK'];
    choose(opts, k => {
      const o = opts[k] || 'BACK';
      if (o === 'SOCKET GEMS') { push(new GemSocketScene(e)); }
      else if (o === 'RUNE FORGE') { push(new RuneForgeScene(e)); }
      else if (o === 'EQUIP') { const why = equipItem(G, e, G.bag); SFX[why ? 'error' : 'equip'](); this.flash(why || `EQUIPPED ${e.name}`); }
      else if (o === 'COMPARE') push(new CompareScene(e));
      else if (o.endsWith('JUNK')) { e.junk = !e.junk; if (e.junk) e.fav = false; SFX.toggle(); }
      else if (o.includes('FAVOURITE')) { e.fav = !e.fav; if (e.fav) e.junk = false; SFX.toggle(); }
      else if (o.startsWith('UPGRADE')) {
        if (!canUp) return this.flash(`${RARITY[e.rarity].name} CAPS AT +${cap}`);
        const need = `${cost.scrap} SCRAP${cost.shard ? `, ${cost.shard} SHARD` : ''}${cost.ember ? `, ${cost.ember} EMBER` : ''}, ${cost.gold}G`;
        if (!canAfford(cost)) { SFX.error(); return say(['Upgrade needs:', need, `You have ${G.inv.scrap || 0} scrap, ${G.inv.shard || 0} shards, ${G.inv.ember || 0} embers.`, 'Salvage gear to get materials.']); }
        choose(['UPGRADE', 'CANCEL'], y => { if (y !== 0) return; for (const q of ['scrap', 'shard', 'ember']) for (let i = 0; i < cost[q]; i++) takeItem(q); G.gold -= cost.gold; e.plus++; e.value = Math.round(e.value * 1.3); SFX.levelup(); this.flash(`${e.name} IS NOW +${e.plus}`); }, `Cost: ${need}`);
      }
      else if (o === 'SALVAGE') { if (e.fav) return this.flash('UNFAVOURITE IT FIRST'); const y = salvage(e); SFX.craft(); this.flash('GOT ' + yieldText(y).toUpperCase().slice(0, 24)); }
      else if (o.startsWith('SELL')) { if (e.fav) return this.flash('UNFAVOURITE IT FIRST'); G.bag.splice(G.bag.indexOf(e), 1); G.gold += e.value; SFX.sell(); }
      else if (o === 'LIST ON AUCTION') { Market.post({ item: e }, Math.max(1, e.value * 4)).then(err => { if (err) { SFX.error(); this.flash(err.toUpperCase()); } else { SFX.auction(); this.flash('LISTED AT 4X VALUE (5% DEPOSIT)'); } }).catch(er => this.flash(String(er.message || er).toUpperCase())); }
    }, e.name.slice(0, 24));
  }
  useMenu(k) {
    const it = ITEMS[k];
    if (this.mode === 'sell') { takeItem(k); G.gold += it.price; SFX.sell(); return; }
    if (it.type === 'use') { const D = derive(G); takeItem(k); if (it.heal) G.hp = Math.min(D.hpMax, G.hp + Math.round(roll(it.heal).total * (1 + Math.max(0, G.lvl - 10) / 10))); if (it.cure) G.buffs = G.buffs.filter(b => b.id !== 'venom'); if (it.buff) { G.buffs = G.buffs.filter(b => b.id !== it.buff); G.buffs.push({ id: it.buff, t: 10, stacks: 1 }); } SFX.drink(); this.flash(`USED ${it.name}`); }
    else if (it.type === 'camp') { removeScene(this); restMenu(); }
    else if (it.type === 'hearth') { removeScene(this); if (!G.inst) travelTo(G.hearth.map, G.hearth.x, G.hearth.y); }
    else if (it.type === 'scroll') this.flash('READ SCROLLS IN BATTLE (ITEM)');
    else this.flash(it.desc.toUpperCase());
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    INV_TABS.forEach(([t], i) => { const x = 2 + i * 40; fill(x, 12, 38, 10, i === this.tab ? 3 : 1); textC(t, x + 19, 13, i === this.tab ? 0 : 3); });
    const L = this.list();
    for (let j = 0; j < INV_ROWS; j++) for (let i = 0; i < INV_COLS; i++) {
      const idx = j * INV_COLS + i, e = L[idx], x = 4 + i * 19, y = 24 + j * 18, sel = i === this.cx && j === this.cy;
      if (this.tab === 0) { const eq = e && equippedFor(G, e); drawItemCell(e, x, y, sel, { up: e && (!eq || itemPower(G, e) > itemPower(G, eq)) }); }
      else { const it = e && ITEMS[e]; drawItemCell(it ? { rarity: 1 } : null, x, y, sel, it ? { icon: it.icon, count: G.inv[e] } : {}); }
    }
    // tooltip
    frame(1, 115, 158, 28);
    const e = this.cur();
    if (this.msg) { text(wrap(this.msg, 25).slice(0, 2).join('\n'), 5, 118, 'gold'); }
    else if (e && this.tab === 0) {
      if (IMG['rg_' + e.rarity]) blit(spr('rg_' + e.rarity, 8, 8), 4, 117); text(e.name.slice(0, 16), 13, 117, rarityCol(e.rarity)); textR(`${SLOT_NAME[itemSlot(e)] === 'RING 1' ? 'RING' : SLOT_NAME[itemSlot(e)]}`, 156, 117, 2);
      const { cur, d } = compareDelta(G, e), sgn = v => (v > 0 ? '+' : '') + (Math.round(v * 10) / 10);
      let line = `IL${e.ilvl} G${formatGearLevel(e)} P${formatPowerLevel(e)}`;
      if (d) { const bits = []; if (d.ac) bits.push(`AC${sgn(d.ac)}`); if (d.hp) bits.push(`HP${sgn(d.hp)}`); if (d.hit) bits.push(`HIT${sgn(d.hit)}`); if (Math.abs(d.dmg) >= 0.1) bits.push(`DMG${sgn(d.dmg)}`); if (d.init) bits.push(`INI${sgn(d.init)}`); line += ' ' + (bits.join(' ') || '= SAME'); }
      else line += ' NEW SLOT!';
      text(line.slice(0, 25), 5, 126, d && Object.values(d).some(v => v < 0) && !Object.values(d).some(v => v > 0) ? 'red' : 'green');
      { const tp = typeof tierPowerText === 'function' ? tierPowerText(e) : ''; const alt = tp && (Date.now() / 2200 | 0) % 2; text((alt ? tp : `${e.adventurerRank || 'F'} RANK  ★${Math.min(12, e.starLevel || 1)}`).slice(0, 25), 5, 135, alt ? 'gold' : 2); }
    } else if (e) { const it = ITEMS[e]; text(it.name.slice(0, 20), 5, 117, 3); textR('x' + G.inv[e], 156, 117, 2); text(wrap(it.desc, 25).slice(0, 2).join('\n'), 5, 126, 2); }
    else text(this.tab === 0 ? `BAG ${G.bag.length}/${BAG_MAX}   ${G.gold} G` : 'EMPTY', 5, 118, 2), text('A:ITEM SEL:TAB START:SORT/JUNK', 5, 130, 1);
  }
}
// ---------------------------------------------------------------- COMPARE (item vs equipped)
class CompareScene {
  constructor(it) { this.opaque = true; this.it = it; }
  update() { if (P('b') || P('a') || P('start')) { SFX.back(); removeScene(this); } }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const it = this.it, { cur, d } = compareDelta(G, it);
    textC('COMPARE', 80, 12, 3); fill(80, 22, 1, 112, 2);
    const col = (x, e, title) => {
      text(title, x, 24, 2);
      if (!e) { text('- EMPTY -', x, 40, 1); return; }
      blit(sprFit(itemIcon(e), 16), x, 34); text(RARITY[e.rarity].name.slice(0, 9), x + 19, 34, rarityCol(e.rarity)); text('IL' + e.ilvl, x + 19, 43, 2);
      text(wrap(e.name, 12).slice(0, 2).join('\n'), x, 54, rarityCol(e.rarity));
      text(itemKeyStat(e).slice(0, 12), x, 74);
      (e.affixes || []).slice(0, 4).forEach(([k, v], i) => text(`+${v}${SUBSTATS[k].unit} ${SUBSTATS[k].name}`.slice(0, 12), x, 84 + i * 9, 2));
      text(rankText(e).slice(0, 12), x, 113, 2); if (e.attune) text('ATTUNE', x, 122, 'purple'); if (e.lore) text(wrap(e.lore, 12)[0], x, 104, 1);
    };
    col(4, it, 'THIS ITEM'); col(84, cur, 'EQUIPPED');
    if (d) { const s = Object.entries(d).filter(([, v]) => Math.abs(v) >= 0.1).map(([k, v]) => `${k.toUpperCase()}${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}`).join(' ') || 'NO CHANGE'; text(s.slice(0, 25), 4, 134, Object.values(d).some(v => v > 0) ? 'green' : 'red'); }
  }
}
// ---------------------------------------------------------------- STASH
class StashScene {
  constructor() { this.opaque = true; this.pane = 1; this.tab = 0; this.cx = 0; this.cy = 0; stashOf(); }
  list() { return this.pane ? G.stash.tabs[this.tab] : G.bag; }
  manageTabs() {
    const st = stashOf(), next = (this.tab + 1) % STASH_TABS;
    const options = ['NEXT TAB', 'RENAME TAB', 'SORT BY RARITY', 'SORT BY NAME'];
    if (next >= st.unlocked) options.unshift(`UNLOCK TAB ${next + 1} (${STASH_COST[next]}G)`);
    choose(options, choice => {
      if (next >= st.unlocked && choice === 0) {
        const cost = STASH_COST[next];
        if (G.gold < cost) { SFX.error(); return say(`Tab ${next + 1} costs ${cost} G.`); }
        G.gold -= cost; st.unlocked = next + 1; this.tab = next; SFX.buy(); saveGame();
        return toast('VAULT TAB UNLOCKED', st.names[next], 'item_chest', 'achievement');
      }
      const action = options[choice];
      if (action === 'NEXT TAB') {
        this.tab = next;
        if (this.tab >= st.unlocked) this.tab = 0;
        this.cx = this.cy = 0; SFX.page(); return;
      }
      if (action === 'RENAME TAB') {
        const names = [...new Set(STASH_TAB_NAMES)].filter(name => name !== st.names[this.tab]);
        choose(names.map(name => `NAME: ${name}`), index => {
          if (index < 0) return;
          st.names[this.tab] = names[index]; saveGame(); SFX.confirm();
          toast('BANK TAB RENAMED', st.names[this.tab], 'item_chest', 'achievement');
        }, `TAB ${this.tab + 1} NAME`);
        return;
      }
      if (action === 'SORT BY RARITY') {
        st.tabs[this.tab].sort((a, b) => (b.fav | 0) - (a.fav | 0) || (b.rarity || 0) - (a.rarity || 0) || (b.ilvl || 0) - (a.ilvl || 0));
        saveGame(); SFX.page(); return say('VAULT TAB SORTED BY RARITY.');
      }
      if (action === 'SORT BY NAME') {
        st.tabs[this.tab].sort((a, b) => String(a.name).localeCompare(String(b.name)));
        saveGame(); SFX.page(); return say('VAULT TAB SORTED BY NAME.');
      }
    }, `${st.names[this.tab]} · BANK & VAULT`);
  }
  update() {
    const st = stashOf();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('select')) { this.pane ^= 1; SFX.page(); return; }
    if (P('start')) return this.manageTabs();
    if (nav('left')) { this.cx = (this.cx + INV_COLS - 1) % INV_COLS; SFX.cursor(); }
    if (nav('right')) { this.cx = (this.cx + 1) % INV_COLS; SFX.cursor(); }
    if (nav('up')) { this.cy = (this.cy + INV_ROWS - 1) % INV_ROWS; SFX.cursor(); }
    if (nav('down')) { this.cy = (this.cy + 1) % INV_ROWS; SFX.cursor(); }
    if (!P('a')) return;
    const L = this.list(), i = this.cy * INV_COLS + this.cx, e = L[i]; if (!e) { SFX.error(); return; }
    const dest = this.pane ? G.bag : st.tabs[this.tab], cap = this.pane ? BAG_MAX : STASH_SIZE;
    if (dest.length >= cap) { SFX.error(); return say(this.pane ? 'Your bag is full.' : 'This stash tab is full. START: next tab.'); }
    L.splice(i, 1); dest.push(e); SFX.equip(); saveGame();
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const st = stashOf();
    for (let t = 0; t < STASH_TABS; t++) {
      const x = 2 + t * 39, on = this.pane && t === this.tab, lock = t >= st.unlocked;
      fill(x, 12, 37, 10, on ? 3 : lock ? 2 : 1);
      textC(lock ? '$' : (STASH_TAB_LABELS[st.names[t]] || st.names[t].slice(0, 5)), x + 18, 13, on ? 0 : 3);
    }
    const L = this.list();
    for (let j = 0; j < INV_ROWS; j++) for (let i = 0; i < INV_COLS; i++) {
      const e = L[j * INV_COLS + i]; drawItemCell(e, 4 + i * 19, 24 + j * 18, i === this.cx && j === this.cy);
    }
    frame(1, 115, 158, 28);
    const e = L[this.cy * INV_COLS + this.cx];
    if (e) { text(e.name.slice(0, 18), 5, 117, rarityCol(e.rarity)); text(`${itemKeyStat(e)} IL${e.ilvl}`.slice(0, 25), 5, 126, 2); }
    else text(this.pane ? `${st.names[this.tab]} ${L.length}/${STASH_SIZE}` : `BAG ${L.length}/${BAG_MAX}`, 5, 118, 2);
    text(this.pane ? 'A:TAKE  SEL:BAG  START:TABS' : 'A:STORE  SEL:VAULT', 5, 135, 1);
  }
}
// ---------------------------------------------------------------- EQUIPMENT (paper doll)
class PaperDoll {
  constructor() { this.opaque = true; this.col = 0; this.row = 0; }
  slot() { return SLOT_COLS[this.col][Math.min(this.row, this.rows() - 1)]; }
  rows() { return Math.min(6, SLOT_COLS[this.col].length); }
  update() {
    if (P('b')) { SFX.back(); removeScene(this); return; }
    const n = this.rows();
    if (nav('up')) { this.row = (Math.min(this.row, n - 1) + n - 1) % n; SFX.cursor(); }
    if (nav('down')) { this.row = (Math.min(this.row, n - 1) + 1) % n; SFX.cursor(); }
    // columns in screen order: left (0), earrings beside the portrait (2), right (1)
    const order = [0, 2, 1], at = order.indexOf(this.col);
    if (nav('right')) { this.col = order[(at + 1) % 3]; SFX.cursor(); }
    if (nav('left')) { this.col = order[(at + 2) % 3]; SFX.cursor(); }
    if (P('select')) { removeScene(this); push(new InventoryScene('field')); return; }
    if (!P('a')) return;
    const slot = this.slot(), opts = G.bag.filter(it => fitsSlot(it, slot)).sort((a, b) => itemPower(G, b) - itemPower(G, a));
    const labels = opts.map(it => `${RARITY[it.rarity].tag}${it.name.slice(0, 15)} ${itemKeyStat(it)}`.slice(0, 24)).concat(G.eq[slot] ? ['- UNEQUIP -'] : []);
    if (!labels.length) { SFX.error(); return say(`Nothing in your bag fits ${SLOT_NAME[slot]}.`); }
    choose(labels, k => {
      if (k < 0) return;
      if (k === opts.length) { if (G.bag.length >= BAG_MAX) return say('Your bag is full.'); G.bag.push(G.eq[slot]); delete G.eq[slot]; G.hp = Math.min(G.hp, derive(G).hpMax); SFX.equip(); return; }
      const why = equipItem(G, opts[k], G.bag, slot); if (why) { SFX.error(); say(why); } else SFX.equip();
    }, `${SLOT_NAME[slot]}: choose`);
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const D = derive(G);
    SLOT_COLS.forEach((col, c) => col.forEach((s, r) => {
      const x = c === 2 ? 110 : c ? 140 : 2, y = 13 + r * 17, it = G.eq[s], sel = c === this.col && r === Math.min(this.row, this.rows() - 1);
      fill(x, y, 18, 16, sel ? 'gold' : 3); fill(x + 1, y + 1, 16, 14, it ? rarityCol(it.rarity) : 1); fill(x + 2, y + 2, 14, 12, 0);
      blit(sprFit(it ? itemIcon(it) : SLOT_ICON[s], 11), x + 3, y + 2);
    }));
    // hero in the middle
    const por = heroPortrait(G); blit(por ? sprFit(por, 46) : sprH(`c_${G.cls}_0`, 42), 57, 14);
    text(G.name.slice(0, 10), 24, 64, 3); text(`LV${G.lvl}`, 110, 64, 2);
    text(`AC ${D.ac}`, 24, 74); text(`HP ${D.hpMax}`, 82, 74);
    text(`HIT ${D.weapon.hit >= 0 ? '+' : ''}${D.weapon.hit}`, 24, 83); text(`DMG ${D.weapon.dice}+${D.weapon.dmg}`.slice(0, 10), 82, 83);
    text(`INIT ${D.init >= 0 ? '+' : ''}${D.init}`, 24, 92); text(`x${D.attacks} ATK`, 82, 92);
    const att = SLOTS.filter(s => G.eq[s] && G.eq[s].attune).length; text(`ATTUNED ${att}/${MAX_ATTUNE}`, 24, 101, 2);
    frame(1, 115, 158, 28);
    const s = this.slot(), it = G.eq[s];
    text(SLOT_NAME[s], 5, 117, 'gold');
    if (it) { textR(itemKeyStat(it), 156, 117, 2); text(it.name.slice(0, 25), 5, 126, rarityCol(it.rarity)); text(((it.affixes || []).map(([k, v]) => `+${v}${SUBSTATS[k].unit}${SUBSTATS[k].name.slice(0, 6)}`).join(' ') || RARITY[it.rarity].name).slice(0, 25), 5, 135, 2); }
    else { text('EMPTY SLOT', 5, 126, 1); text('A:EQUIP  SEL:INVENTORY', 5, 135, 1); }
  }
}
