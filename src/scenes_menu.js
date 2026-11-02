// GB QUEST menus: main menu, bag, equipment, character sheet, spellbook, growth (ASI, subclass,
// feats, ascension, boons), quest log, crafting, achievements, bestiary, reputation, social,
// rest, settings, sound test, auction house, bank.
'use strict';

function hdr() {
  fill(0, 0, W, 11, 0); fill(0, 11, W, 1, 3);
  const d = new Date(); text(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, 3, 1);
  text(`LV${G.lvl}`, 40, 1, 2);
  if (NET.room) text(NET.server ? 'HOST' : NET.hostOf ? 'JOIN' : 'LIVE', 72, 1, 'blue');
  const g = fmt(G.gold); textR(g, W - 3, 1); blit(sprFit('icon_3_3', 8), W - 13 - g.length * 6, 1);
}
class ListScene { // reusable scrolling list base
  constructor(rows = 9) { this.opaque = true; this.i = 0; this.top = 0; this.rows = rows; }
  items() { return []; }
  navList() {
    const n = this.items().length; if (!n) return;
    if (nav('up')) { this.i = (this.i + n - 1) % n; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % n; SFX.cursor(); }
    if (nav('left')) { this.i = Math.max(0, this.i - this.rows); SFX.cursor(); }
    if (nav('right')) { this.i = Math.min(n - 1, this.i + this.rows); SFX.cursor(); }
    this.i = Math.min(this.i, n - 1);
    if (this.i < this.top) this.top = this.i; if (this.i >= this.top + this.rows) this.top = this.i - this.rows + 1;
  }
  scrollbar(x, y, h) { const n = this.items().length; if (n <= this.rows) return; fill(x, y, 3, h, 1); const bh = Math.max(6, h * this.rows / n); fill(x, y + (h - bh) * this.top / Math.max(1, n - this.rows), 3, bh, 3); }
}

// ================================================================ MAIN MENU
class MainMenu extends ListScene {
  constructor() { super(11); }
  items() { return ['BAG', 'EQUIPMENT', 'CHARACTER', 'SPELLBOOK', 'GROWTH' + (G.pending.asi || G.pending.sub || G.pending.boon || G.ascPts || G.subPts || G.talentPts ? ' (!)' : ''), 'QUEST LOG', 'CRAFTING', 'REST', 'ACTIVITY FINDER', 'BESTIARY', 'ACHIEVEMENTS', 'REPUTATION', 'SOCIAL', 'TITLES', 'WORLD MAP', 'HEARTHSTONE', 'SETTINGS', 'SAVE', 'SAVE & QUIT']; }
  update() {
    this.navList();
    if (P('b') || P('start')) { SFX.close(); removeScene(this); return; }
    if (!P('a')) return;
    SFX.select();
    const o = this.items()[this.i].replace(' (!)', '');
    const map = { BAG: () => new InventoryScene('field'), EQUIPMENT: () => new PaperDoll(), CHARACTER: () => new CharSheet(), SPELLBOOK: () => new Spellbook(), GROWTH: () => new GrowthScene(),
      'QUEST LOG': () => new QuestLog(), CRAFTING: () => new CraftScene(), 'ACTIVITY FINDER': () => new ActivityFinderScene(), BESTIARY: () => new BestiaryScene(), ACHIEVEMENTS: () => new AchievementScene(), REPUTATION: () => new RepScene(),
      SOCIAL: () => new SocialScene(), TITLES: () => new TitleScene(), 'WORLD MAP': () => new WorldMap(), SETTINGS: () => new SettingsScene() };
    if (map[o]) return push(map[o]());
    if (o === 'REST') return restMenu();
    if (o === 'HEARTHSTONE') { if (G.inst) return say('You cannot hearth from inside an instance.'); removeScene(this); return travelTo(G.hearth.map, G.hearth.x, G.hearth.y); }
    if (o === 'SAVE') { const ok = saveGame(); SFX[ok ? 'confirm' : 'error'](); return say(ok ? `Saved to slot ${G.slot + 1}.` : 'Could not save (storage blocked).'); }
    if (o === 'SAVE & QUIT') { saveGame(); fadeTo(() => reset(new Title())); }
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const D = derive(G);
    fill(58, 12, 1, H - 12, 3);
    blit(heroPortrait(G) ? sprFit(heroPortrait(G), 40) : sprH(`c_${G.cls}_0`, 34), 9, 14);
    textC(G.name.slice(0, 9), 29, 54, 3); textC(CLASSES[G.cls].name, 29, 64, 2);
    text('HP', 3, 76, 2); bar(16, 77, 40, 4, G.hp, D.hpMax, 'hp');
    text('XP', 3, 86, 2); bar(16, 87, 40, 4, G.xp - xpForLevel(G.lvl), xpForLevel(Math.min(LEVEL_CAP, G.lvl + 1)) - xpForLevel(G.lvl), 'xp');
    text(`AC ${D.ac}`, 3, 96); text(diffOf().name.slice(0, 9), 3, 106, 2);
    const ch = chapterDef(); text(ch ? `CH${ch.i + 1}/50` : 'DONE', 3, 116, 'gold'); text(modeOf().name, 3, 126, 2);
    this.items().slice(this.top, this.top + this.rows).forEach((s, j) => { const i = this.top + j, y = 15 + j * 12; if (i === this.i) { fill(60, y - 2, 96, 12, 3); text(s, 66, y, 0); } else text(s, 66, y); });
    this.scrollbar(156, 14, 128);
  }
}
function restMenu() {
  choose(['SHORT REST (1 HOUR)', `LONG REST (CAMP KIT x${G.inv.campkit || 0})`, 'BACK'], k => {
    if (k === 0) { if (G.ghost) return say('Spirits cannot rest.'); const songs = G.companions.some(c => hasFeature(c, 'restsong')) || hasFeature(G, 'restsong'); const log = shortRest(G, songs); G.companions.forEach(c => shortRest(c, songs)); SFX.heal(); say(['You take a short rest.'].concat(log.length ? log : ['Nothing to recover (no hit dice?).'])); }
    if (k === 1) { if (!G.inv.campkit) return say('You need a CAMP KIT (merchants sell them), or rest at an inn.'); takeItem('campkit'); longRest(G); G.companions.forEach(longRest); Music.play('inn'); SFX.heal(); say('You make camp and sleep through the night. Fully restored.'); }
  }, `HP ${G.hp}/${derive(G).hpMax}  HIT DICE ${G.hd}/${derive(G).hdMax}`);
}
class ActivityFinderScene extends ListScene {
  constructor() { super(7); this.category = 0; }
  categories() { return ['DUNGEONS', 'RAIDS', 'SPIRE', 'EVENTS']; }
  items() {
    if (this.category === 0) return DUNGEONS.filter(entry => entry.lvl <= G.lvl + 6).map(entry => ({ ...entry, activityKind: 'dungeon' }));
    if (this.category === 1) return RAIDS.filter(entry => entry.lvl <= G.lvl + 6).map(entry => ({ ...entry, activityKind: 'raid' }));
    if (this.category === 2) return [{ id: 'tower', name: TOWER.name, lvl: TOWER.baseLvl, activityKind: 'tower' }];
    return WORLD_EVENTS.map(event => ({ ...event, ...worldEventWindow(event) }))
      .sort((a, b) => a.startsAt - b.startsAt);
  }
  update() {
    if (P('select')) { this.category = (this.category + 1) % this.categories().length; this.i = this.top = 0; SFX.page(); }
    this.navList();
    if (P('b') || P('start')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const entry = this.items()[this.i];
    if (!entry) return;
    SFX.select();
    if (entry.activityKind === 'dungeon' || entry.activityKind === 'raid') return instanceMenu(entry.activityKind, entry);
    if (entry.activityKind === 'tower') return towerMenu();
    return worldEventMenu(entry);
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    text('ACTIVITY FINDER', 4, 14, 'gold');
    this.categories().forEach((label, index) => {
      const x = 3 + index * 39;
      fill(x, 25, 37, 10, index === this.category ? 3 : 1);
      textC(label.slice(0, 6), x + 18, 26, index === this.category ? 0 : 3);
    });
    const list = this.items();
    if (!list.length) textC(this.category === 3 ? 'NO EVENTS' : 'NO MATCHES', 80, 57, 2);
    list.slice(this.top, this.top + this.rows).forEach((entry, offset) => {
      const index = this.top + offset, y = 39 + offset * 10;
      if (index === this.i) fill(3, y - 1, 150, 10, 3);
      const level = entry.lvl || entry.level || 1;
      const status = entry.activityKind ? '' : entry.status === 'active' ? ' LIVE' : ` ${Math.max(1, Math.ceil((entry.startsAt - Date.now()) / 60000))}M`;
      text(`${entry.name.slice(0, 15)}${status}`.slice(0, 23), 6, y, index === this.i ? 0 : 3);
      textR(`L${level}`, 151, y, index === this.i ? 0 : 2);
    });
    this.scrollbar(156, 39, 72);
    const entry = list[this.i];
    if (entry) {
      frame(3, 113, 153, 28);
      const detail = entry.activityKind === 'tower' ? '100 FLOORS - CHECKPOINTS' :
        entry.activityKind === 'dungeon' || entry.activityKind === 'raid' ? `${entry.activityKind.toUpperCase()} ENTRANCE` :
          `${ZONE_BY_ID[entry.zone]?.name || entry.zone} - ${entry.status === 'active' ? 'ACTIVE NOW' : 'UPCOMING'}`;
      text(wrap(detail, 24).slice(0, 2).join('\n'), 7, 117, 2);
    }
    text('SELECT: PAGE', 4, 143, 1);
  }
}
// ================================================================ BAG
class BagScene extends ListScene {
  constructor(mode) { super(7); this.mode = mode; this.tab = 0; this.msg = null; this.mt = 0; }
  items() {
    if (this.tab === 0) return G.bag.slice().sort((a, b) => itemSlot(a).localeCompare(itemSlot(b)) || b.rarity - a.rarity);
    const want = this.tab === 1 ? ['use', 'scroll', 'camp', 'hearth'] : this.tab === 2 ? ['mat'] : ['junk', 'key'];
    return Object.keys(G.inv).filter(k => ITEMS[k] && want.includes(ITEMS[k].type) && G.inv[k] > 0);
  }
  update() {
    if (this.mt > 0 && --this.mt === 0) this.msg = null;
    if (P('select')) { this.tab = (this.tab + 1) % 4; this.i = this.top = 0; SFX.page(); }
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const L = this.items(); if (!L.length) return;
    const e = L[this.i];
    if (this.tab === 0) {
      if (this.mode === 'sell') { G.bag.splice(G.bag.indexOf(e), 1); G.gold += e.value; SFX.sell(); return this.flash(`Sold for ${e.value} G.`); }
      choose(['EQUIP', 'SELL ' + e.value + 'G', 'LIST ON AUCTION', 'DROP', 'BACK'], k => {
        if (k === 0) { const why = equipItem(G, e, G.bag); SFX[why ? 'error' : 'equip'](); this.flash(why || `Equipped ${e.name}.`); }
        if (k === 1) { G.bag.splice(G.bag.indexOf(e), 1); G.gold += e.value; SFX.sell(); }
        if (k === 2) { G.bag.splice(G.bag.indexOf(e), 1); G.ah.push({ item: e, price: e.value * 4, steps: G.stats.steps }); G.stats.auctions = (G.stats.auctions || 0) + 1; SFX.auction(); this.flash('Listed! Gold arrives by mail.'); }
        if (k === 3) { G.bag.splice(G.bag.indexOf(e), 1); SFX.back(); }
      }, e.name);
    } else {
      const it = ITEMS[e];
      if (this.mode === 'sell') { takeItem(e); G.gold += it.price; SFX.sell(); return; }
      if (it.type === 'use') { const D = derive(G); takeItem(e); if (it.heal) G.hp = Math.min(D.hpMax, G.hp + Math.round(roll(it.heal).total * (1 + Math.max(0, G.lvl - 10) / 10))); if (it.cure) G.buffs = G.buffs.filter(b => b.id !== 'venom'); if (it.buff) { G.buffs = G.buffs.filter(b => b.id !== it.buff); G.buffs.push({ id: it.buff, fights: 5 }); } SFX[it.heal ? 'eat' : 'drink'](); this.flash(`Used ${it.name}.`); }
      else if (it.type === 'camp') { removeScene(this); restMenu(); }
      else if (it.type === 'hearth') { removeScene(this); if (!G.inst) travelTo(G.hearth.map, G.hearth.x, G.hearth.y); }
      else if (it.type === 'scroll') this.flash('Scrolls are read in battle (ITEM).');
      else this.flash(it.desc);
    }
  }
  flash(m) { this.msg = m; this.mt = 120; }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    ['GEAR', 'USE', 'MATS', 'OTHER'].forEach((t, i) => { const x = 3 + i * 39; fill(x, 13, 37, 10, i === this.tab ? 3 : 1); textC(t, x + 18, 14, i === this.tab ? 0 : 3); });
    const L = this.items();
    if (!L.length) textC('Empty.', 80, 60, 1);
    L.slice(this.top, this.top + this.rows).forEach((e, j) => {
      const i = this.top + j, y = 26 + j * 12;
      if (i === this.i) fill(2, y - 2, 152, 12, 1);
      if (this.tab === 0) {
        blit(sprFit(itemIcon(e), 10), 4, y - 1);
        text(RARITY[e.rarity].tag, 16, y, rarityCol(e.rarity)); text(e.name.slice(0, 17), 22, y, rarityCol(e.rarity));
        const cur = G.eq[itemSlot(e)]; if (!cur || itemScore(G, e) > itemScore(G, cur)) text('^', 148, y, 'green');
      } else { const it = ITEMS[e]; blit(sprFit(it.icon, 10), 4, y - 1); text(it.name.slice(0, 17), 18, y); textR('x' + G.inv[e], 150, y); }
    });
    this.scrollbar(156, 25, 84);
    frame(2, 110, 156, 32);
    const e = L[this.i];
    let d = this.msg || '';
    if (!d && e) d = this.tab === 0 ? itemDesc(e) : ITEMS[e].desc;
    text(wrap(d, 24).slice(0, 3).join('\n'), 6, 113);
    if (this.tab === 0) textR(`${G.bag.length}/${BAG_MAX}`, 156, 14 + 0, 3);
    text('SEL:TAB', 120, 102, 1);
  }
}
function itemDesc(it) {
  let s = `${RARITY[it.rarity].name} IL${it.ilvl}. `;
  if (it.kind === 'weapon') { const w = WEAPONS[it.base]; s += `${w.dmg}${w.vdmg ? '/' + w.vdmg : ''} ${w.type.slice(0, 5)}${it.plus > 0 ? ` +${it.plus}` : ''}. `; if (it.legend) s += `+${it.legend.extra} ${it.legend.etype}. `; }
  if (it.kind === 'armor') { const a = ARMORS[it.base]; s += a.type === 'shield' ? `AC +${2 + Math.max(0, it.plus)}. ` : `AC ${a.ac + Math.max(0, it.plus)}${a.dexMax == null ? '+DEX' : a.dexMax ? '+DEX(2)' : ''} ${a.type}. `; }
  if (it.kind === 'wondrous') s += `${WONDROUS.find(w => w.id === it.base).bonus.toUpperCase()} +${it.plus}. `;
  s += it.affixes.map(([k, v]) => `+${v}${SUBSTATS[k].unit} ${SUBSTATS[k].name}`).join(', ');
  if (it.attune) s += ' (ATTUNE)';
  return s;
}

// ================================================================ EQUIPMENT
class EquipScene extends ListScene {
  constructor() { super(6); }
  items() { return SLOTS; }
  update() {
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const slot = SLOTS[this.i], opts = G.bag.filter(it => itemSlot(it) === slot);
    const labels = opts.map(it => `${RARITY[it.rarity].tag}${it.name.slice(0, 18)}`).concat(G.eq[slot] ? ['- UNEQUIP -'] : []);
    if (!labels.length) { SFX.error(); return; }
    choose(labels, k => {
      if (k < 0) return;
      if (k === opts.length) { G.bag.push(G.eq[slot]); delete G.eq[slot]; SFX.equip(); return; }
      const why = equipItem(G, opts[k], G.bag); if (why) { SFX.error(); say(why); } else SFX.equip();
    }, `${SLOT_NAME[slot]}: choose`);
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const D = derive(G);
    blit(heroPortrait(G) ? sprFit(heroPortrait(G), 48) : sprH(`c_${G.cls}_0`, 46), 4, 18);
    text(`AC ${D.ac}`, 6, 70); text(`ATK ${D.weapon.hit >= 0 ? '+' : ''}${D.weapon.hit}`, 6, 80); text(`DMG ${D.weapon.dice}+${D.weapon.dmg}`, 6, 90); text(`x${D.attacks}`, 6, 100, 2);
    const att = SLOTS.filter(s => G.eq[s] && G.eq[s].attune).length; text(`ATTUNE ${att}/3`, 6, 112, 2);
    SLOTS.forEach((s, i) => {
      const y = 16 + i * 16, it = G.eq[s];
      if (i === this.i) fill(52, y - 2, 106, 15, 1);
      blit(sprFit(it ? itemIcon(it) : SLOT_ICON[s], 12), 55, y);
      text(SLOT_NAME[s], 70, y - 1, 2); text(it ? it.name.slice(0, 14) : '-', 70, y + 6, it ? rarityCol(it.rarity) : 1);
    });
    frame(2, 114, 156, 28);
    const it = G.eq[SLOTS[this.i]]; text(wrap(it ? itemDesc(it) : 'Empty slot. A: equip from bag.', 24).slice(0, 2).join('\n'), 6, 118);
  }
}

// ================================================================ CHARACTER SHEET (5 pages)
class CharSheet {
  constructor() { this.opaque = true; this.page = 0; this.scroll = 0; }
  update() {
    if (nav('left')) { this.page = (this.page + 4) % 5; this.scroll = 0; SFX.page(); }
    if (nav('right')) { this.page = (this.page + 1) % 5; this.scroll = 0; SFX.page(); }
    if (nav('down')) this.scroll++; if (nav('up')) this.scroll = Math.max(0, this.scroll - 1);
    if (P('b') || P('a')) { SFX.back(); removeScene(this); }
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const D = derive(G), pages = ['OVERVIEW', 'ATTRIBUTES', 'SAVES/SKILLS', 'SUBSTATS', 'FEATURES'];
    textC(`< ${pages[this.page]} >`, 80, 13, 2); fill(2, 22, 156, 1, 3);
    const p = this.page;
    if (p === 0) {
      blit(heroPortrait(G) ? sprFit(heroPortrait(G), 44) : sprH(`c_${G.cls}_0`, 40), 2, 26);
      const sub = G.sub ? CLASSES[G.cls].subs.find(s => s.id === G.sub).name : '-';
      [[G.name], [`${SPECIES[G.species].name} ${CLASSES[G.cls].name}`], [`SUB: ${sub}`], [`BG: ${BACKGROUNDS[G.bg].name}`], [`LEVEL ${G.lvl}${G.lvl > 20 ? ' (ASCENDED)' : ''}`], [`XP ${fmt(G.xp)}/${fmt(xpForLevel(Math.min(LEVEL_CAP, G.lvl + 1)))}`]].forEach(([s], i) => text(s.slice(0, 18), 48, 26 + i * 10, i ? 3 : 'gold'));
      const rows = [`HP ${G.hp}/${D.hpMax}   AC ${D.ac}`, `PROF +${D.pb}   INIT ${D.init >= 0 ? '+' : ''}${D.init}`, `HIT DICE ${G.hd}/${D.hdMax} (d${D.cls.hd})`, `PASSIVE PERCEPTION ${D.passive}`, D.spell ? `SPELL DC ${D.spell.dc}  ATK +${D.spell.atk}` : 'NO SPELLCASTING', `CRIT ${D.critRange}-20 +${D.crit}%`];
      rows.forEach((s, i) => text(s, 6, 88 + i * 9));
    } else if (p === 1) {
      ATTRS.forEach((a, i) => { const y = 26 + i * 12; text(a, 6, y, 2); text(String(D.A[a]).padStart(3), 30, y); text(`(${D.M[a] >= 0 ? '+' : ''}${D.M[a]})`, 52, y, 2); text(ATTR_DESC[a].slice(0, 15), 72, y, 1); });
    } else if (p === 2) {
      ATTRS.forEach((a, i) => { const y = 26 + i * 9; text(`${a} ${D.saves[a] >= 0 ? '+' : ''}${D.saves[a]}`, 4, y, D.cls.saves.includes(a) ? 'gold' : 3); });
      const sk = Object.keys(SKILLS).slice(this.scroll % 18).concat(Object.keys(SKILLS)).slice(0, 12);
      sk.forEach((k, i) => text(`${SKILL_NAME[k].slice(0, 10).padEnd(10)}${D.skills[k] >= 0 ? '+' : ''}${D.skills[k]}`, 60, 26 + i * 9, D.skills[k] > D.M[SKILLS[k]] ? 'gold' : 3));
    } else if (p === 3) {
      const rows = [['CRIT', D.crit + '%'], ['CRIT DMG', D.critdmg + '%'], ['DODGE', D.dodge + '%'], ['BLOCK', D.block + '%'], ['LIFESTEAL', D.leech + '%'], ['HASTE', D.haste + '%'], ['DAMAGE', '+' + D.dmgPct + '%'], ['HEALING', '+' + D.healPct + '%'], ['RESIST ALL', D.resistAll + '%'], ['THORNS', D.thorns], ['MAGIC FIND', D.mf + '%'], ['GOLD FIND', D.gf + '%'], ['XP BONUS', D.xpPct + '%']].concat(Object.entries(D.elem).map(([k, v]) => [k.toUpperCase(), '+' + v + '%']));
      rows.slice(this.scroll % rows.length).concat(rows).slice(0, 12).forEach(([k, v], i) => { text(k, 6, 26 + i * 9, 2); textR(String(v), 150, 26 + i * 9); });
    } else {
      const feats = CLASSES[G.cls].features.filter(([l]) => l <= D.CL).map(([l, f]) => `L${l} ${FEATURE_NAME[f]}`);
      if (G.sub) feats.push('SUB: ' + CLASSES[G.cls].subs.find(s => s.id === G.sub).desc);
      G.feats.forEach(f => feats.push('FEAT: ' + FEATS[f].name));
      SPECIES[G.species].traits.forEach(t => feats.push('TRAIT: ' + t.toUpperCase()));
      G.boons.forEach(b => feats.push('BOON: ' + MYTHIC_BOONS.find(x => x.id === b).name));
      if (D.res.size) feats.push('RESIST: ' + [...D.res].join(',').toUpperCase());
      feats.slice(this.scroll % Math.max(1, feats.length)).slice(0, 12).forEach((s, i) => text(s.slice(0, 25), 4, 26 + i * 9));
    }
  }
}

// ================================================================ SPELLBOOK
class Spellbook extends ListScene {
  constructor() {
    super(6);
    this.schools = ['all', 'aegis', 'calling', 'omen', 'thrall', 'storm', 'veil', 'grave', 'flux'];
    this.tab = 0;
    this.all = false;
  }
  schoolDef() {
    const k = this.schools[this.tab];
    return k === 'all' ? { id: 'all', name: 'ALL SCHOOLS', desc: 'The eight arcane traditions of Aelmoor.' } : { id: k, ...SCHOOLS[k] };
  }
  items() {
    const D = derive(G);
    const k = this.schools[this.tab];
    const hasSpells = D.spell && D.spell.known && D.spell.known.length;
    const pool = (!hasSpells || this.all) ? SPELLS : D.spell.known;
    return k === 'all' ? pool : pool.filter(s => s.school === k);
  }
  update() {
    const n = this.schools.length;
    if (P('select')) { this.tab = (this.tab + 1) % n; this.i = this.top = 0; SFX.page(); }
    if (nav('left')) { this.tab = (this.tab + n - 1) % n; this.i = this.top = 0; SFX.page(); }
    if (nav('right')) { this.tab = (this.tab + 1) % n; this.i = this.top = 0; SFX.page(); }
    if (P('start')) { this.all = !this.all; this.i = this.top = 0; SFX.toggle(); }
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('a')) { SFX.select(); }
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const D = derive(G), L = this.items();
    const sch = this.schoolDef();
    const hasSpells = D.spell && D.spell.known && D.spell.known.length;
    const mode = (!hasSpells || this.all) ? 'ALL' : 'KNOWN';

    // Subheader
    if (D.spell) {
      text(resLine(G, D), 4, 13, 2);
      textR(`DC${D.spell.dc} +${D.spell.atk}`, 156, 13, 2);
    } else {
      text('SPELL COMPENDIUM', 4, 13, 'gold');
      textR('8 SCHOOLS', 156, 13, 2);
    }

    // School tab banner
    fill(2, 23, 156, 10, 1);
    textC(`< ${sch.name} (${L.length}) >`, 80, 24, 'gold');

    // Spell list
    if (!L.length) {
      frame(2, 35, 156, 58);
      textC(`No ${mode === 'KNOWN' ? 'known ' : ''}${sch.name} spells.`, 80, 48, 1);
      if (mode === 'KNOWN') textC('Press START: view all in school', 80, 60, 'gold');
      else textC(wrap(sch.desc, 24)[0] || '', 80, 60, 2);
      textC('SEL / < >: cycle schools', 80, 74, 2);
    } else {
      L.slice(this.top, this.top + this.rows).forEach((s, j) => {
        const i = this.top + j, y = 35 + j * 10;
        const isKnown = D.spell && D.spell.known && D.spell.known.some(k => k.id === s.id);
        if (i === this.i) fill(2, y - 1, 152, 10, 1);
        text(s.lvl ? `L${s.lvl}` : 'C', 4, y, isKnown ? 'gold' : 2);
        text((isKnown ? '*' : ' ') + s.name.slice(0, 15), 14, y, isKnown ? 3 : 1);
        textR(SCHOOLS[s.school].name.slice(0, 6), 154, y, 2);
      });
      this.scrollbar(156, 35, 58);
    }

    // Detail box
    frame(2, 95, 156, 47);
    const s = L[this.i];
    if (s) {
      text(`${SCHOOLS[s.school].name} · ${s.lvl ? 'L' + s.lvl : 'CANTRIP'}${s.conc ? ' · CONC' : ''}${s.bonus ? ' · BONUS' : ' · ACT'}`, 5, 97, 'gold');
      const hit = s.save ? `${s.save} SAVE${s.half ? ' (1/2)' : ''}` : s.atk ? 'SPELL ATK' : (s.eff || '').toUpperCase();
      const tags = [s.t ? s.t.toUpperCase() : '', hit, s.dt ? s.dt.toUpperCase() : '', s.dice || ''].filter(Boolean).join(' · ');
      text(tags.slice(0, 25), 5, 106, 2);
      text(wrap(s.desc + (s.scale ? ` (+${s.scale})` : ''), 25).slice(0, 2).join('\n'), 5, 115);
      const clsList = (s.cls || []).map(c => c.slice(0, 3).toUpperCase()).join('/');
      text(`CLS:${clsList || 'ALL'}`, 5, 133, 2);
      textR(`SEL:SCH START:${mode}`, 155, 133, 1);
    } else {
      text(`${sch.name} TRADITION`, 5, 97, 'gold');
      text(wrap(sch.desc, 25).slice(0, 2).join('\n'), 5, 108);
      textR(`SEL:SCH START:${mode}`, 155, 133, 1);
    }
  }
}

// ================================================================ GROWTH: talents, ASI, feats, subclass, ascension, boons
class GrowthScene extends ListScene {
  constructor() { super(9); }
  items() {
    const o = [{ t: `TALENT SYSTEM (${G.talentPts || 0} PTS)`, d: 'Choose a path and spend talent points on permanent character bonuses.', fn: () => push(new TalentScene()) }];
    if (G.pending.sub && classLevel(G) >= 3) CLASSES[G.cls].subs.forEach(s => o.push({ t: `SUBCLASS: ${s.name}`, d: s.desc, fn: () => { G.sub = s.id; G.pending.sub = false; G.res = resMax(G); } }));
    if (G.pending.asi) {
      ATTRS.slice(0, 6).forEach(a => o.push({ t: `+2 ${a} (${G.base[a]})`, d: 'Ability Score Increase. Max 20.', fn: () => { if (G.base[a] >= 20) return 'Already 20.'; G.base[a] = Math.min(20, G.base[a] + 2); G.pending.asi--; } }));
      Object.keys(FEATS).filter(f => !G.feats.includes(f)).forEach(f => o.push({ t: `FEAT: ${FEATS[f].name}`, d: FEATS[f].desc, fn: () => { G.feats.push(f); G.pending.asi--; } }));
    }
    if (G.pending.boon) MYTHIC_BOONS.filter(b => !G.boons.includes(b.id)).forEach(b => o.push({ t: `BOON: ${b.name}`, d: b.desc, fn: () => { G.boons.push(b.id); G.pending.boon--; } }));
    if (G.ascPts > 0) ATTRS.forEach(a => o.push({ t: `ASCEND ${a} (${G.ascPts} PTS)`, d: `+1 ${a}. ${ATTR_DESC[a]}`, fn: () => { G.ascAttr[a] = (G.ascAttr[a] || 0) + 1; G.ascPts--; } }));
    if (G.subPts > 0) AFFIX_POOL.forEach(k => o.push({ t: `${SUBSTATS[k].name} (${G.subPts} PTS)`, d: `Invest in ${SUBSTATS[k].name}.`, fn: () => { G.ascSub[k] = (G.ascSub[k] || 0) + 1; G.subPts--; } }));
    if (!o.length) o.push({ t: 'NOTHING TO SPEND', d: 'Level up to earn ASIs (4,8,12,16,19), a subclass (3), ascension points (21+) and mythic boons (every 50).', fn: () => 'Nothing yet.' });
    return o;
  }
  update() {
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('a')) { const e = this.items()[this.i]; const r = e.fn(); SFX[r ? 'error' : 'levelup'](); if (r) say(r); const D = derive(G); G.hp = Math.min(G.hp, D.hpMax); checkAchievements(); }
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    textC('GROWTH', 80, 13, 'gold');
    const L = this.items();
    L.slice(this.top, this.top + this.rows).forEach((e, j) => { const i = this.top + j, y = 24 + j * 10; if (i === this.i) fill(2, y - 1, 152, 10, 1); text(e.t.slice(0, 24), 6, y); });
    this.scrollbar(156, 23, 90);
    frame(2, 114, 156, 28); text(wrap(L[this.i].d, 24).slice(0, 2).join('\n'), 6, 118);
  }
}

class TalentScene extends ListScene {
  constructor() { super(4); this.tree = 0; }
  path() { return TALENT_TREES[this.tree]; }
  items() { return this.path().nodes.concat([{ id: 'respec', name: 'RESET TALENTS', level: 0, desc: 'Refund all talent points and clear selected talents.', respec: true }]); }
  update() {
    if (P('select')) { this.tree = (this.tree + 1) % TALENT_TREES.length; this.i = this.top = 0; SFX.page(); }
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const node = this.items()[this.i];
    if (!node) return;
    if (node.respec) {
      if (!G.talents.length) return say('No talents to reset.');
      choose(['RESET ALL TALENTS', 'CANCEL'], index => {
        if (index !== 0) return;
        G.talentPts = (G.talentPts || 0) + G.talents.length;
        G.talents = [];
        G.hp = Math.min(G.hp, derive(G).hpMax);
        SFX.levelup();
      }, 'Refund all spent talent points?');
      return;
    }
    if (G.talents.includes(node.id)) return say(`${node.name} is already learned.`);
    if (G.lvl < node.level) return say(`Unlocks at level ${node.level}.`);
    if (node.requires && !G.talents.includes(node.requires)) {
      const prerequisite = this.path().nodes.find(candidate => candidate.id === node.requires);
      return say(`Learn ${prerequisite ? prerequisite.name : 'the previous talent'} first.`);
    }
    if ((G.talentPts || 0) < 1) return say('No talent points available. Earn one at levels 5, 10, 15 and 20.');
    G.talents.push(node.id);
    G.talentPts--;
    G.hp = Math.min(G.hp, derive(G).hpMax);
    SFX.levelup();
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    textC('TALENT SYSTEM', 80, 13, 'gold');
    TALENT_TREES.forEach((tree, index) => {
      const x = 3 + index * 52;
      fill(x, 24, 49, 11, index === this.tree ? 3 : 1);
      textC(tree.name.slice(0, 8), x + 24, 25, index === this.tree ? 0 : 3);
    });
    text(`POINTS ${G.talentPts || 0}   LEVEL ${G.lvl}`, 5, 38, 2);
    const L = this.items();
    L.slice(this.top, this.top + this.rows).forEach((node, offset) => {
      const index = this.top + offset, y = 50 + offset * 11;
      const learned = !node.respec && G.talents.includes(node.id);
      const eligible = node.respec || (G.lvl >= node.level && (!node.requires || G.talents.includes(node.requires)));
      if (index === this.i) fill(3, y - 1, 153, 10, 1);
      text(learned ? '*' : node.respec ? '!' : eligible ? '+' : '-', 5, y, learned ? 'gold' : eligible ? 3 : 1);
      text(node.name.slice(0, 21), 14, y, eligible ? 3 : 1);
      if (!node.respec) textR(`L${node.level}`, 152, y, learned ? 'gold' : 2);
    });
    const node = L[this.i];
    frame(2, 101, 156, 41);
    if (node) {
      text(node.name + (G.talents.includes(node.id) ? ' LEARNED' : ''), 6, 104, 'gold');
      text(wrap(node.desc, 24).slice(0, 2).join('\n'), 6, 114, 3);
      if (node.requires && !G.talents.includes(node.id)) text(`REQ: ${this.path().nodes.find(n => n.id === node.requires)?.name || 'PREVIOUS'}`.slice(0, 24), 6, 134, 2);
    }
    text('SELECT: PATH', 4, 143, 1);
  }
}

// ================================================================ QUEST LOG
class QuestLog extends ListScene {
  constructor() { super(5); }
  items() {
    const o = []; const ch = chapterDef();
    o.push({ t: ch ? `ACT ${ch.act}: ${ACTS[ch.act - 1].name}` : 'STORY COMPLETE', d: ch ? `CH.${ch.i + 1} ${ch.title}\n${ch.line}\n${chapterGoal(ch)}` : 'All 12 acts and 50 chapters are done.', main: true });
    for (const id in G.sideq) { const st = G.sideq[id]; if (st.state === 'done') continue; const d = sideQuestDef(id); if (d) o.push({ t: d.name, d: `${d.text}\n${st.state === 'ready' ? 'READY: return to the warden.' : `Progress ${st.prog}/${d.count}`} (${ZONE_BY_ID[d.zone].name})` }); }
    return o;
  }
  update() { this.navList(); if (P('b') || P('a')) { SFX.back(); removeScene(this); } }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    text(`STORY ${G.chapter}/50   QUESTS DONE ${G.stats.quests}`, 4, 14, 2);
    const L = this.items();
    L.slice(this.top, this.top + this.rows).forEach((e, j) => { const i = this.top + j, y = 26 + j * 11; if (i === this.i) fill(2, y - 2, 152, 11, 1); text(e.main ? '*' : '!', 4, y, e.main ? 'gold' : 3); text(e.t.slice(0, 23), 12, y); });
    frame(2, 84, 156, 58); text(wrap(L[this.i].d, 24).slice(0, 5).join('\n'), 6, 88);
  }
}

// ================================================================ CRAFTING
class CraftScene extends ListScene {
  constructor() { super(8); }
  items() { return RECIPES; }
  update() { this.navList(); if (P('b')) { SFX.back(); removeScene(this); return; } if (P('a')) { const r = craft(RECIPES[this.i]); SFX[r.startsWith('Made') ? 'craft' : 'error'](); this.msg = r; } }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    text(`ALCH ${G.prof.alch}  COOK ${G.prof.cook}  HERB ${G.prof.herb}  FISH ${G.prof.fish}`, 2, 14, 2);
    RECIPES.slice(this.top, this.top + this.rows).forEach((r, j) => { const i = this.top + j, y = 25 + j * 10; const ok = G.prof[r.prof] >= r.skill && Object.keys(r.needs).every(k => (G.inv[k] || 0) >= r.needs[k]); if (i === this.i) fill(2, y - 1, 152, 10, 1); blit(sprFit(ITEMS[r.makes].icon, 9), 4, y); text(r.name.slice(0, 18), 16, y, ok ? 3 : 1); textR(`${PROFS[r.prof].slice(0, 4)}${r.skill}`, 154, y, 2); });
    const r = RECIPES[this.i]; frame(2, 108, 156, 34);
    text(Object.entries(r.needs).map(([k, n]) => `${ITEMS[k].name.slice(0, 10)} ${G.inv[k] || 0}/${n}`).join('\n'), 6, 111);
    if (this.msg) textR(this.msg.slice(0, 14), 154, 131, 'gold');
  }
}

// ================================================================ ACHIEVEMENTS / BESTIARY / REPUTATION
class AchievementScene extends ListScene {
  constructor() { super(10); }
  items() { return ACHIEVEMENTS; }
  update() { this.navList(); if (P('b') || P('a')) { SFX.back(); removeScene(this); } }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    text(`POINTS ${achPoints()}  ${Object.keys(G.ach).length}/${ACHIEVEMENTS.length}`, 4, 14, 'gold');
    ACHIEVEMENTS.slice(this.top, this.top + this.rows).forEach((a, j) => { const i = this.top + j, y = 25 + j * 10, got = !!G.ach[a.id]; if (i === this.i) fill(2, y - 1, 152, 10, 1); checkbox(4, y + 1, got); text(a.name.slice(0, 22), 14, y, got ? 3 : 1); });
    frame(2, 126, 156, 16); text(ACHIEVEMENTS[this.i].desc.slice(0, 24), 6, 130);
  }
}
class BestiaryScene extends ListScene {
  constructor() { super(8); }
  items() { return BESTIARY; }
  update() { this.navList(); if (P('b') || P('a')) { SFX.back(); removeScene(this); } }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    text(`BESTIARY ${Object.keys(G.bestiary).length}/${BESTIARY.length}`, 4, 14, 'gold');
    BESTIARY.slice(this.top, this.top + this.rows).forEach((b, j) => { const i = this.top + j, y = 25 + j * 10, seen = G.bestiary[b.id]; if (i === this.i) fill(2, y - 1, 90, 10, 1); text(`${String(b.no).padStart(3, '0')} ${seen ? b.name.slice(0, 10) : '???'}`, 4, y, seen ? 3 : 1); });
    this.scrollbar(93, 24, 80);
    const b = BESTIARY[this.i], seen = G.bestiary[b.id];
    frame(96, 24, 62, 62); if (seen) blit(sprFit(monsterArt(b), 50), 102, 30); else textC('?', 127, 50, 1, 2);
    frame(2, 106, 156, 36);
    if (seen) { text(`${b.type} / ${b.sub}${b.rank === 'elite' ? ' ELITE' : ''}`.slice(0, 24), 6, 109, 2); text(`DMG ${b.dt.toUpperCase()} ${b.res.length ? 'RES ' + b.res[0].toUpperCase() : ''}`.slice(0, 24), 6, 118); text(`${b.lore}`.slice(0, 24), 6, 127, 1); textR(`KILLS ${seen.kills}`, 154, 90, 2); }
    else text('Defeat one to learn more.', 6, 115, 1);
  }
}
class RepScene {
  constructor() { this.opaque = true; }
  update() { if (P('b') || P('a')) { SFX.back(); removeScene(this); } }
  draw() {
    fill(0, 0, W, H, 0); hdr(); textC('REPUTATION', 80, 13, 'gold');
    Object.entries(FACTIONS).forEach(([k, n], i) => { const v = G.rep[k] || 0, y = 26 + i * 18; text(n, 6, y); textR(repTier(v), 154, y, 2); bar(6, y + 10, 148, 4, Math.min(4000, v), 4000, 'gold'); });
    text(`HONOR ${G.honor}  ARENA ${G.rating}`, 6, 120); text(`RENOWN ${Object.values(G.renown).reduce((a, b) => a + b, 0)}`, 6, 130, 2);
  }
}

// ================================================================ SOCIAL: party, leaderboard, server, guild, who
class SocialScene extends ListScene {
  constructor() { super(9); this.lb = null; this.loading = false; }
  items() { return ['PARTY', 'SERVER / MULTIPLAYER', 'LEADERBOARD', 'WHO (ONLINE)', 'GUILD', 'PET', 'CHAT HELP']; }
  update() {
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const o = this.items()[this.i]; SFX.select();
    if (o === 'PARTY') say(G.companions.length ? G.companions.map(c => `${c.name} LV${c.lvl} ${CLASSES[c.cls].name} HP${c.hp}`) : ['No companions. Hire them at an inn (TANK/HEALER/DAMAGE) or invite players you meet.']);
    if (o === 'SERVER / MULTIPLAYER') serverMenu();
    if (o === 'LEADERBOARD') { this.loading = true; NET.leaderboard().then(r => { this.loading = false; const rows = (r && r.length ? r : realmPlayersIn('ardenhold').map(p => ({ name: p.name, lvl: p.lvl, cls: p.cls, ach: 0 }))).slice(0, 10); say([r && r.length ? 'REALM LEADERBOARD (LIVE)' : 'LEADERBOARD (OFFLINE SAMPLE)'].concat(rows.map((h, i) => `${i + 1}. ${clean(h.name)} LV${h.lvl} ${(CLASSES[h.cls] || { name: '' }).name.slice(0, 6)}`))); }); }
    if (o === 'WHO (ONLINE)') say([`LIVE PLAYERS: ${NET.peers.length} (${NET.status || 'OFFLINE'})`].concat(NET.peers.slice(0, 8).map(p => `${clean((p.presence || {}).n || 'HERO')} LV${(p.presence || {}).l || '?'}`)).concat([`REALM NPC HEROES: ${realmPlayersIn(G.map).length} here`]));
    if (o === 'GUILD') guildMenu();
    if (o === 'PET') { if (!G.pets.length) return say('No pets yet. Earn one at 100 kills.'); choose(G.pets.map(p => p.toUpperCase()).concat(['NONE']), i => { G.pet = i < G.pets.length && i >= 0 ? G.pets[i] : null; }); }
    if (o === 'CHAT HELP') say(['Type in the chat box under the handheld and press Enter. Live players in this page see it, and it shows above your hero.']);
  }
  draw() {
    fill(0, 0, W, H, 0); hdr(); textC('SOCIAL', 80, 13, 'gold');
    this.items().forEach((s, i) => { const y = 26 + i * 12; if (i === this.i) { fill(4, y - 2, 152, 12, 3); text(s, 10, y, 0); } else text(s, 10, y); });
    text(`MODE: ${modeOf().name}  NET: ${NET.status || 'OFFLINE'}`, 4, 124, 2);
    text(G.guild ? `<${G.guild}>` : 'NO GUILD', 4, 134, 2);
    if (this.loading) textC('LOADING...', 80, 110, 'blue');
  }
}

// ================================================================ AUCTION HOUSE & BANK
class AuctionHouse extends ListScene {
  constructor() {
    super(7);
    const r = RNG('ah-' + new Date().toDateString() + G.lvl);
    this.list = Array.from({ length: 12 }, () => { const it = makeItem({ lvl: Math.max(1, G.lvl + r.int(-3, 4)), rarity: r.pick([1, 2, 2, 3, 3, 4]) }); return { it, price: Math.round(it.value * (2 + r() * 2)), seller: r.pick(SIM_NAMES) }; });
    // settle player listings
    for (const l of G.ah.slice()) if (G.stats.steps - l.steps > 60 || R() < 0.3) { G.ah.splice(G.ah.indexOf(l), 1); const g = Math.round(l.price * 0.95); G.mail.push({ from: 'AUCTION HOUSE', text: `${l.item.name} sold!`, gold: g }); toast('AUCTION SOLD', `+${g}G (check mail)`, 'item_coin', 'auction'); }
  }
  items() { return this.list; }
  update() {
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('select')) { removeScene(this); push(new InventoryScene('field')); return; }
    if (!P('a')) return;
    const e = this.list[this.i]; if (!e) return;
    if (G.gold < e.price) { SFX.error(); return say('Not enough gold.'); }
    G.gold -= e.price; addGear(e.it); this.list.splice(this.i, 1); SFX.buy();
  }
  draw() {
    fill(0, 0, W, H, 0); hdr(); text('AUCTION HOUSE', 4, 14, 'gold'); textR(`MY LISTINGS ${G.ah.length}`, 156, 14, 2);
    this.list.slice(this.top, this.top + this.rows).forEach((e, j) => { const i = this.top + j, y = 25 + j * 11; if (i === this.i) fill(2, y - 1, 152, 11, 1); blit(sprFit(itemIcon(e.it), 9), 4, y); text(e.it.name.slice(0, 14), 16, y, rarityCol(e.it.rarity)); textR(fmt(e.price), 154, y, 2); });
    const e = this.list[this.i]; frame(2, 104, 156, 38);
    if (e) { text(`SELLER ${e.seller}`, 6, 107, 2); text(wrap(itemDesc(e.it), 24).slice(0, 2).join('\n'), 6, 117); }
    text('SEL: sell from bag', 6, 136, 1);
  }
}
class BankScene extends ListScene {
  constructor() { super(8); this.side = 0; }
  items() { return this.side ? G.bank : G.bag; }
  update() {
    if (P('select')) { this.side ^= 1; this.i = this.top = 0; SFX.page(); }
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const L = this.items(), e = L[this.i]; if (!e) return;
    L.splice(this.i, 1); (this.side ? G.bag : G.bank).push(e); SFX.equip();
  }
  draw() {
    fill(0, 0, W, H, 0); hdr(); text(this.side ? `BANK ${G.bank.length}/60 (A: withdraw)` : `BAG ${G.bag.length}/${BAG_MAX} (A: deposit)`, 4, 14, 'gold');
    this.items().slice(this.top, this.top + this.rows).forEach((e, j) => { const i = this.top + j, y = 25 + j * 11; if (i === this.i) fill(2, y - 1, 152, 11, 1); blit(sprFit(itemIcon(e), 9), 4, y); text(e.name.slice(0, 20), 16, y, rarityCol(e.rarity)); });
    text('SELECT: switch bag/bank', 6, 134, 1);
  }
}

// ================================================================ SETTINGS & SOUND TEST
class SettingsScene extends ListScene {
  constructor() { super(11); }
  navList() { const n = this.items().length; if (nav('up')) { this.i = (this.i + n - 1) % n; SFX.cursor(); } if (nav('down')) { this.i = (this.i + 1) % n; SFX.cursor(); } }
  items() { return ['PALETTE', 'VIDEO', 'TILES', 'ART', 'AUDIO', 'SFX VOLUME', 'MUSIC VOLUME', 'BRIGHTNESS', 'CONTRAST', 'TEXT SPEED', 'WEATHER', 'AUTO BATTLE', 'SWAP A/B', 'DIFFICULTY', 'SOUND TEST', 'DEBUG PANEL', 'ABOUT', 'FULL SCREEN']; }
  update() {
    this.navList();
    if (P('b')) { saveSettings(); SFX.back(); removeScene(this); return; }
    const d = nav('right') || P('a') ? 1 : nav('left') ? -1 : 0; if (!d) return;
    const o = this.items()[this.i], clamp = v => Math.max(0, Math.min(6, v));
    if (o === 'PALETTE') { const k = PAL_ORDER.indexOf(S.palette); S.palette = PAL_ORDER[(k + (d > 0 ? 1 : PAL_ORDER.length - 1)) % PAL_ORDER.length]; UI = PALS[S.palette]; clearCaches(); }
    if (o === 'AUDIO') { S.audio = S.audio === 'hd64' ? 'chip' : 'hd64'; const c = Music.cur; Music.cur = null; Music.step = 0; if (c) Music.play(c); }
    if (o === 'VIDEO') { if (S.video === 'hd64') { S.video = 'gb'; S.palette = S.palPrev || 'gbc'; } else { S.video = 'hd64'; S.palPrev = S.palette; S.palette = 'full'; } UI = PALS[S.palette]; clearCaches(); }
    if (o === 'ART') { S.art = S.art === 'classic' ? 'nes' : 'classic'; applyArt(); clearCaches(); }
    if (o === 'TILES') S.tiles = S.tiles === 'painted' ? 'pixel' : 'painted';
    if (o === 'SFX VOLUME') S.vol = clamp(S.vol + d);
    if (o === 'MUSIC VOLUME') S.music = clamp(S.music + d);
    if (o === 'BRIGHTNESS') S.bright = clamp(S.bright + d);
    if (o === 'CONTRAST') S.contrast = clamp(S.contrast + d);
    if (o === 'TEXT SPEED') S.textSpeed = Math.max(0, Math.min(3, S.textSpeed + d));
    if (o === 'WEATHER') S.weather = !S.weather;
    if (o === 'AUTO BATTLE') S.autoBattle = !S.autoBattle;
    if (o === 'SWAP A/B') S.swap = !S.swap;
    if (o === 'FULL SCREEN') { S.fullscreen = !S.fullscreen; document.body.classList.toggle('fullscreen-mode', S.fullscreen); }
    if (o === 'DIFFICULTY' && G) { difficultyMenu(); return; }
    if (o === 'SOUND TEST' && P('a')) { push(new SoundTest()); return; }
    if (o === 'DEBUG PANEL' && P('a')) { window.DBG && DBG.toggle(); return; }
    if (o === 'ABOUT' && P('a')) { say([`${BUILD.game}: ${BUILD.subtitle}`, `Version ${BUILD.version} build ${BUILD.build}`, `A game by ${BUILD.studio}`, 'EXPANSIONS:', ...BUILD.expansions, `${ZONES.length} zones, ${BESTIARY.length} creatures, ${BOSSES.length} bosses, ${SPELLS.length} spells, ${SFX_NAMES.length} sound effects, ${Object.keys(TRACKS).length} music tracks.`]); return; }
    saveSettings(); SFX.toggle();
  }
  draw() {
    fill(0, 0, W, H, 0); if (G) hdr(); else { fill(0, 0, W, 11, 0); }
    textC('SETTINGS', 80, 13, 'gold');
    const v = [PALS[S.palette].name, S.video === 'hd64' ? '64-BIT' : 'GAME BOY', S.tiles === 'painted' ? 'PAINTED' : 'PIXEL', S.art === 'classic' ? 'CLASSIC' : 'NES', S.audio === 'hd64' ? '64-BIT' : 'CHIP 4CH', S.vol, S.music, S.bright, S.contrast, ['SLOW', 'NORMAL', 'FAST', 'INSTANT'][S.textSpeed], S.weather ? 'ON' : 'OFF', S.autoBattle ? 'ON' : 'OFF', S.swap ? 'ON' : 'OFF', G ? diffOf().name : '-', '>', 'F9', '>', S.fullscreen ? 'ON' : 'OFF'];
    this.top = Math.max(0, Math.min(this.i - 5, this.items().length - 11)); this.items().slice(this.top, this.top + 11).forEach((s, j) => { const i = this.top + j, y = 24 + j * 10; if (i === this.i) fill(2, y - 1, 156, 10, 1); text(s, 6, y); typeof v[i] === 'number' ? segBar(108, y + 1, v[i], 6) : textR(String(v[i]), 154, y, 2); });
  }
}
class SoundTest extends ListScene {
  constructor() { super(10); this.tab = 0; }
  items() { return this.tab ? Object.keys(TRACKS) : (S.audio === 'hd64' && typeof SFX64_ONLY !== 'undefined' ? SFX_NAMES.concat(SFX64_ONLY) : SFX_NAMES); }
  update() {
    if (P('select')) { this.tab ^= 1; this.i = this.top = 0; SFX.page(); }
    if (P('start')) { S.audio = S.audio === 'hd64' ? 'chip' : 'hd64'; saveSettings(); this.i = Math.min(this.i, this.items().length - 1); const c = Music.cur; Music.cur = null; if (c && this.tab) Music.play(c); SFX.toggle(); }
    this.navList();
    if (P('b')) { removeScene(this); Music.stop(); const t = topScene(); t && t.resume && t.resume(); return; }
    if (P('a')) { const k = this.items()[this.i]; if (this.tab) { Music.cur = null; Music.play(k); } else SFX[k](); }
  }
  draw() {
    fill(0, 0, W, H, 0); fill(0, 0, W, 11, 3);
    textC((S.audio === 'hd64' ? '64-BIT ' : 'CHIP ') + (this.tab ? `MUSIC ${Object.keys(TRACKS).length}` : `SFX ${this.items().length}`), 80, 1, 0);
    this.items().slice(this.top, this.top + this.rows).forEach((s, j) => { const i = this.top + j, y = 15 + j * 11; if (i === this.i) fill(2, y - 1, 152, 11, 1); text(`${String(i + 1).padStart(3, '0')} ${s.toUpperCase()}`, 6, y); });
    this.scrollbar(156, 14, 110);
    text('A:PLAY SEL:SFX/MUSIC START:ENGINE', 2, 134, 2);
  }
}
