// LOST KINGDOM OF SHADOWBANE CHRONICLES menus: main menu, bag, equipment, character sheet, spellbook, growth (ASI, subclass,
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
  items() { const base = ['CHARACTER', 'SPELLBOOK', 'GROWTH' + (G.pending.asi || G.pending.sub || G.pending.boon || G.ascPts || G.subPts || G.talentPts ? ' (!)' : ''), 'COMBAT ARTS', 'ARMOURY', 'HEIRLOOMS', 'WARDROBE', 'LOADOUTS', 'JOBS', 'CHALLENGES', 'MOUNTS', 'QUEST LOG', 'CRAFTING', 'REST', 'ACTIVITY FINDER', 'BESTIARY', 'BOSS JOURNAL', 'ACHIEVEMENTS', 'REPUTATION', 'SOCIAL', 'TITLES', 'WORLD MAP', 'EXPANSION MAPS', 'HEARTHSTONE', 'SETTINGS', 'SAVE', 'SAVE & QUIT']; if (globalThis.GBQEasterEggs && globalThis.GBQEasterEggs.summary(G).discovered > 0) base.splice(base.indexOf('ACHIEVEMENTS'), 0, 'SECRET ARCHIVE'); if (globalThis.GBQSecretWorld && globalThis.GBQSecretWorld.summary(G).discovered > 0) base.splice(base.indexOf('ACHIEVEMENTS'), 0, 'HIDDEN WORLD'); return base; }
  update() {
    this.navList();
    if (P('b') || P('start')) { SFX.close(); removeScene(this); return; }
    if (!P('a')) return;
    SFX.select();
    const o = this.items()[this.i].replace(' (!)', '');
    const map = { CHARACTER: () => new CharacterMenu(), SPELLBOOK: () => new Spellbook(), GROWTH: () => new GrowthScene(),
      'COMBAT ARTS': () => new ArtsScene(), ARMOURY: () => new ArmoryScene(), HEIRLOOMS: () => new HeirloomScene(), MOUNTS: () => new MountScene(), 'QUEST LOG': () => new QuestLog(), CRAFTING: () => new CraftScene(), 'ACTIVITY FINDER': () => new ActivityFinderScene(), BESTIARY: () => new BestiaryScene(), 'BOSS JOURNAL': () => new BossJournalScene(), 'SECRET ARCHIVE': () => new EasterEggArchiveScene(), 'HIDDEN WORLD': () => new SecretWorldJournalScene(), ACHIEVEMENTS: () => new AchievementScene(), REPUTATION: () => new RepScene(),
      SOCIAL: () => new SocialScene(), TITLES: () => new TitleScene(), 'WORLD MAP': () => new WorldMap(), 'EXPANSION MAPS': () => new ExpansionMapsScene(), SETTINGS: () => new SettingsScene() };
    if (map[o]) return push(map[o]());
    if (o === 'REST') return restMenu();
    if (o === 'CHALLENGES' && typeof challengesMenu === 'function') return challengesMenu();
    if (o === 'WARDROBE' && typeof wardrobeMenu === 'function') return wardrobeMenu();
    if (o === 'LOADOUTS' && typeof loadoutsMenu === 'function') return loadoutsMenu();
    if (o === 'JOBS' && typeof jobsMenu === 'function') return jobsMenu();
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
        if (k === 2) { Market.post({ item: e }, Math.max(1, e.value * 4)).then(err => { if (err) { SFX.error(); this.flash(err); } else { SFX.auction(); this.flash('Listed at 4x value.'); } }).catch(er => this.flash(String(er.message || er))); }
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
  constructor() { super(9); }
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
      if (k === opts.length) { G.bag.push(G.eq[slot]); delete G.eq[slot]; G.hp = Math.min(G.hp, derive(G).hpMax); SFX.equip(); return; }
      const why = equipItem(G, opts[k], G.bag); if (why) { SFX.error(); say(why); } else SFX.equip();
    }, `${SLOT_NAME[slot]}: choose`);
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const D = derive(G);
    blit(heroPortrait(G) ? sprFit(heroPortrait(G), 48) : sprH(`c_${G.cls}_0`, 46), 4, 18);
    text(`AC ${D.ac}`, 6, 70); text(`ATK ${D.weapon.hit >= 0 ? '+' : ''}${D.weapon.hit}`, 6, 80); text(`DMG ${D.weapon.dice}+${D.weapon.dmg}`, 6, 90); text(`x${D.attacks}`, 6, 100, 2);
    const att = SLOTS.filter(s => G.eq[s] && G.eq[s].attune).length; text(`ATTUNE ${att}/3`, 6, 112, 2);
    SLOTS.slice(this.top, this.top + this.rows).forEach((s, j) => {
      const i = this.top + j, y = 29 + j * 9, it = G.eq[s];
      if (i === this.i) fill(52, y - 1, 106, 8, 1);
      blit(sprFit(it ? itemIcon(it) : SLOT_ICON[s], 7), 54, y);
      text(SLOT_NAME[s].slice(0, 8), 64, y, 2); text(it ? it.name.slice(0, 11) : '-', 112, y, it ? rarityCol(it.rarity) : 1);
    });
    frame(2, 114, 156, 28);
    const it = G.eq[SLOTS[this.i]]; text(wrap(it ? itemDesc(it) : 'Empty slot. A: equip from bag.', 24).slice(0, 2).join('\n'), 6, 118);
  }
}

// ================================================================ CHARACTER SHEET (5 pages)
class CharSheet {
  constructor() { this.opaque = true; this.page = 0; this.scroll = 0; }
  update() {
    if (nav('left')) { this.page = (this.page + 5) % 6; this.scroll = 0; SFX.page(); }
    if (nav('right')) { this.page = (this.page + 1) % 6; this.scroll = 0; SFX.page(); }
    if (nav('down')) this.scroll++; if (nav('up')) this.scroll = Math.max(0, this.scroll - 1);
    if (P('b') || P('a')) { SFX.back(); removeScene(this); }
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const D = derive(G), pages = ['OVERVIEW', 'ATTRIBUTES', 'SAVES/SKILLS', 'SUBSTATS', 'FEATURES', 'COMBAT'];
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
    } else if (p === 4) {
      const feats = CLASSES[G.cls].features.filter(([l]) => l <= D.CL).map(([l, f]) => `L${l} ${FEATURE_NAME[f]}`);
      if (G.sub) feats.push('SUB: ' + CLASSES[G.cls].subs.find(s => s.id === G.sub).desc);
      G.feats.forEach(f => feats.push('FEAT: ' + FEATS[f].name));
      SPECIES[G.species].traits.forEach(t => feats.push('TRAIT: ' + t.toUpperCase()));
      G.boons.forEach(b => feats.push('BOON: ' + MYTHIC_BOONS.find(x => x.id === b).name));
      if (D.res.size) feats.push('RESIST: ' + [...D.res].join(',').toUpperCase());
      feats.slice(this.scroll % Math.max(1, feats.length)).slice(0, 12).forEach((s, i) => text(s.slice(0, 25), 4, 26 + i * 9));
    } else {
      const weapon = D.weapon || {};
      const rows = [
        ['WEAPON', weapon.name || 'FISTS'],
        ['DAMAGE DICE', weapon.dice || '1d1'],
        ['DAMAGE BONUS', (Number(weapon.dmg) > 0 ? '+' : '') + (weapon.dmg || 0)],
        ['ATTACK HIT', (Number(weapon.hit) > 0 ? '+' : '') + (weapon.hit || 0)],
        ['ATTACKS / TURN', D.attacks || 1],
        ['ARMOR CLASS', D.ac],
        ['INITIATIVE', (D.init >= 0 ? '+' : '') + D.init],
        ['CRITICAL RANGE', `${D.critRange}-20`],
        ['CRITICAL CHANCE', `${D.crit}%`],
        ['CRITICAL DAMAGE', `${D.critdmg}%`],
        ['DODGE', `${D.dodge}%`],
        ['BLOCK', `${D.block}%`],
        ['LIFESTEAL', `${D.leech}%`],
        ['HASTE', `${D.haste}%`]
      ];
      rows.slice(this.scroll % rows.length).concat(rows).slice(0, 12).forEach(([key, value], i) => {
        const y = 26 + i * 9;
        text(String(key).slice(0, 16), 5, y, 2);
        textR(String(value).slice(0, 12), 154, y, 3);
      });
      text('UP / DOWN: MORE STATS', 5, 137, 'gold');
    }
  }
}

// ================================================================ CHARACTER HUB (profile, inventory, equipment)
class CharacterMenu {
  constructor() { this.opaque = true; this.tab = 0; }
  tabs() { return [['CHARACTER', 'CHAR'], ['INVENTORY', 'BAG'], ['EQUIPMENT', 'GEAR']]; }
  update() {
    if (P('b') || P('start')) { SFX.back(); removeScene(this); return; }
    if (nav('left')) { this.tab = (this.tab + 2) % 3; SFX.page(); }
    if (nav('right') || P('select')) { this.tab = (this.tab + 1) % 3; SFX.page(); }
    if (!P('a')) return;
    SFX.select();
    if (this.tab === 0) push(new CharSheet());
    else if (this.tab === 1) push(new InventoryScene('field'));
    else push(new PaperDoll());
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const diablo = S.uiTheme === 'diablo';
    if (diablo) { fill(1, 10, 158, 133, 0); frame(1, 10, 158, 133); fill(2, 11, 156, 10, 1); textC('CHARACTER', 80, 12, 'gold'); }
    this.tabs().forEach(([name, label], index) => {
      const x = 2 + index * 52, active = index === this.tab;
      fill(x, 23, 50, 10, active ? (diablo ? 'gold' : 3) : 1); textC(label, x + 25, 24, active ? 0 : 3);
    });
    textC(this.tab === 0 ? 'STATS - A: FULL SHEET' : this.tab === 1 ? 'BAG - A: OPEN BAGS' : 'GEAR - A: EQUIPMENT', 80, 35, 'gold');
    const D = derive(G), portrait = heroPortrait(G);
    fill(2, 46, 52, 82, diablo ? 3 : 1); fill(57, 46, 101, 82, diablo ? 3 : 1); if (diablo) { frame(2, 46, 52, 82); frame(57, 46, 101, 82); }
    blit(portrait ? sprFit(portrait, 42) : sprH(`c_${G.cls}_0`, 42), 7, 49);
    text(G.name.slice(0, 8), 5, 93, 'gold');
    text(CLASSES[G.cls].name.slice(0, 8), 5, 102, 2);
    text(`LV ${G.lvl}`, 5, 111, 3);
    text('HP', 5, 120, 2); bar(18, 121, 33, 4, G.hp, D.hpMax, 'hp');
    if (this.tab === 1) { // bag preview: the first 15 items as icons
      const bag = G.bag || [];
      for (let k = 0; k < 15; k++) { const it = bag[k], x = 60 + (k % 5) * 19, y = 49 + Math.floor(k / 5) * 19; fill(x, y, 18, 18, it ? rarityCol(it.rarity === undefined ? 1 : it.rarity) : 2); fill(x + 1, y + 1, 16, 16, 0); if (it) { const ic = itemIcon(it); if (ic && IMG[ic]) blit(sprFit(ic, 13), x + 3, y + 3); } }
      text(`ITEMS ${bag.length}/${BAG_MAX}`, 60, 108, 3); text(`GOLD ${fmt(G.gold)}`.slice(0, 16), 60, 118, 'gold');
    } else {
    // paper doll: 7 slot icons down each side, stats in the middle (no more overlapping slot names)
    const gearSlots = ['head', 'neck', 'back', 'armor', 'hands', 'waist', 'legs', 'feet', 'ring1', 'ring2', 'weapon', 'offhand', 'artifact', 'relic'];
    const blackbirdSlotArt = { head: 'bb_helm', neck: 'bb_neck', back: 'bb_cloak', armor: 'bb_slot', hands: 'bb_gloves', waist: 'bb_belt', legs: 'bb_slot', feet: 'bb_boots', ring1: 'bb_ring1', ring2: 'bb_ring2', weapon: 'bb_weapon1', offhand: 'bb_weapon2', artifact: 'bb_trinket', relic: 'bb_trinket' };
    if (this.tab === 2) gearSlots.forEach((slot, index) => {
      const item = G.eq[slot], x = index < 7 ? 59 : 146, y = 48 + (index % 7) * 11;
      fill(x, y, 11, 11, item ? rarityCol(item.rarity === undefined ? 1 : item.rarity) : 2); fill(x + 1, y + 1, 9, 9, 0);
      if (item) { const ic = itemIcon(item); if (ic && IMG[ic]) blit(sprFit(ic, 8), x + 2, y + 2); }
      else if (S.uiTheme === 'blackbird' && IMG[blackbirdSlotArt[slot]]) blit(sprFit(blackbirdSlotArt[slot], 8), x + 2, y + 2);
    });
    const prim = CLASSES[G.cls].primary, ilv = (() => { const L = gearSlots.map(s => G.eq[s]).filter(Boolean); return L.length ? Math.round(L.reduce((a, it) => a + (it.ilvl || 1), 0) / L.length) : 0; })();
    if (this.tab === 2) { const short = { head: 'HEAD', neck: 'NECK', back: 'BACK', armor: 'CHEST', hands: 'HANDS', waist: 'WAIST', legs: 'LEGS', feet: 'FEET', ring1: 'RING', ring2: 'RING', weapon: 'MAIN', offhand: 'OFF', artifact: 'ARTI', relic: 'RELIC' };
      for (let k = 0; k < 7; k++) { const y = 50 + k * 11; text(short[gearSlots[k]], 72, y, G.eq[gearSlots[k]] ? 3 : 2); textR(short[gearSlots[k + 7]], 144, y, G.eq[gearSlots[k + 7]] ? 3 : 2); }
    } else [[`HP`, `${D.hpMax}`], ['AC', `${D.ac}`], [prim, `${D.A[prim]}`], ['ILVL', `${ilv}`], ['GEAR', `${gearSlots.filter(s => G.eq[s]).length}/14`], ['BAG', `${G.bag.length}/${BAG_MAX}`]].forEach(([k, v], i) => {
      text(k, 62, 50 + i * 12, 2); textR(String(v).slice(0, 8), 154, 50 + i * 12, 3);
    });
    }
    fill(2, 135, 156, 8, diablo ? 1 : 0); text('START: MENU', 5, 136, 'gold'); textR('SELECT: TAB', 155, 136, 2);
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
      text(`${SCHOOLS[s.school].name} - ${s.lvl ? 'L' + s.lvl : 'CANTRIP'}${s.conc ? ' - CONC' : ''}${s.bonus ? ' - BONUS' : ' - ACT'}`.slice(0, 25), 5, 97, 'gold');
      const hit = s.save ? `${s.save} SAVE${s.half ? ' (1/2)' : ''}` : s.atk ? 'SPELL ATK' : (s.eff || '').toUpperCase();
      const tags = [s.t ? s.t.toUpperCase() : '', hit, s.dt ? s.dt.toUpperCase() : '', s.dice || ''].filter(Boolean).join(' - ');
      text(tags.slice(0, 25), 5, 106, 2);
      text(wrap(s.desc + (s.scale ? ` (+${s.scale})` : ''), 25).slice(0, 2).join('\n'), 5, 115);
      const clsList = (s.cls || []).map(c => c.slice(0, 3).toUpperCase()).join('/');
      text(`${(s.cls || []).length ? (s.cls || []).length + ' CLASSES' : 'ALL CLASSES'}`, 5, 133, 2);
      textR(`SEL:SCHOOL`, 155, 133, 2);
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
    const o = [{ t: `TALENT SYSTEM (${G.talentPts || 0} PTS)`, d: 'Choose a path and spend talent points on permanent character bonuses.', fn: () => { push(new TalentScene()); } },
      { t: `ACTIVE / PASSIVE SKILLS (${G.skillPts || 0} PTS)`, d: 'Learn once-per-battle active abilities and permanent passive bonuses.', fn: () => { push(new AbilitySkillsScene()); } }];
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

class AbilitySkillsScene extends ListScene {
  constructor() { super(8); this.kind = 'active'; }
  catalog() { return (this.kind === 'active' ? ACTIVE_SKILLS : PASSIVE_SKILLS).filter(skill => skill.classes.includes(G.cls)); }
  learned() { return this.kind === 'active' ? G.activeSkills : G.passiveSkills; }
  update() {
    if (P('select')) { this.kind = this.kind === 'active' ? 'passive' : 'active'; this.i = this.top = 0; SFX.page(); }
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const skill = this.catalog()[this.i];
    if (this.learned().includes(skill.id)) { SFX.error(); return say(`${skill.name} is already learned.`); }
    if (G.lvl < skill.level) { SFX.error(); return say(`${skill.name} unlocks at level ${skill.level}.`); }
    if ((G.skillPts || 0) < 1) { SFX.error(); return say('No skill points available. Earn one every 3 levels.'); }
    const before = derive(G).hpMax;
    this.learned().push(skill.id); G.skillPts--;
    const after = derive(G).hpMax; G.hp = Math.min(after, G.hp + Math.max(0, after - before));
    SFX.levelup(); toast('SKILL LEARNED', skill.name, 'px_rune', 'levelup');
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    textC(`${CLASSES[G.cls].name} SKILLS`, 80, 13, 'gold');
    fill(5, 22, 70, 10, this.kind === 'active' ? 3 : 1); textC('ACTIVE', 40, 23, this.kind === 'active' ? 0 : 3);
    fill(85, 22, 70, 10, this.kind === 'passive' ? 3 : 1); textC('PASSIVE', 120, 23, this.kind === 'passive' ? 0 : 3);
    text(`POINTS ${G.skillPts || 0}   LEVEL ${G.lvl}`, 5, 36, 2);
    const list = this.catalog(), learned = this.learned();
    list.slice(this.top, this.top + this.rows).forEach((skill, offset) => {
      const index = this.top + offset, y = 49 + offset * 10, known = learned.includes(skill.id), eligible = G.lvl >= skill.level;
      if (index === this.i) fill(3, y - 1, 153, 9, 1);
      if (skill.icon && IMG[skill.icon]) blit(spr(skill.icon, 8, 8, { ghost: !eligible }), 4, y); else text(known ? '*' : eligible ? '+' : '-', 5, y, known ? 'gold' : eligible ? 3 : 1);
      if (known) text('*', 134, y, 'gold');
      text(skill.name.slice(0, 20), 14, y, eligible ? 3 : 1); textR(`L${skill.level}`, 153, y, known ? 'gold' : 2);
    });
    const selected = list[this.i]; frame(2, 105, 156, 37);
    text(selected ? `${selected.name}${learned.includes(selected.id) ? ' LEARNED' : ''}` : '', 6, 108, 'gold');
    if (selected) text(wrap(selected.desc, 24).slice(0, 2).join('\n'), 6, 119, 3);
    text('SELECT: ACTIVE/PASSIVE', 4, 143, 1);
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
      if (node.icon && IMG[node.icon]) blit(spr(node.icon, 8, 8, { ghost: !eligible }), 4, y); else text(learned ? '*' : node.respec ? '!' : eligible ? '+' : '-', 5, y, learned ? 'gold' : eligible ? 3 : 1);
      if (learned) text('*', 134, y, 'gold');
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
    for (const x of EXPANSIONS) {
      const state = G.expansionCampaigns && G.expansionCampaigns[x.id]; if (!state) continue;
      const campaign = EXPANSION_CAMPAIGNS[x.n - 1], step = campaign.steps[state.step];
      const status = state.done ? 'CAMPAIGN COMPLETE' : `STEP ${state.step + 1}/4: ${step ? step.title : 'Continue the campaign.'}`;
      const progress = !state.done && state.step === 1 ? `Foes defeated: ${state.kills || 0}/${campaign.steps[1].target}.` : '';
      o.push({ t: x.name, d: `${status}\n${progress}\n${state.done ? campaign.epilogue : campaign.beats[state.step] || campaign.intro}\nFinal reward: ${fmt(campaign.reward.xp)} XP, ${fmt(campaign.reward.gold)} G.`, campaign: true, icon: campaign.icon, done: state.done });
    }
    for (const id in G.sideq) { const st = G.sideq[id]; if (st.state === 'done') continue; const d = sideQuestDef(id); if (d) o.push({ t: d.name, d: `${d.text}\n${st.state === 'ready' ? 'READY: return to the warden.' : `Progress ${st.prog}/${d.count}`} (${ZONE_BY_ID[d.zone].name})` }); }
    return o;
  }
  update() { this.navList(); if (P('b') || P('a')) { SFX.back(); removeScene(this); } }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    text(`STORY ${G.chapter}/50   QUESTS DONE ${G.stats.quests}`, 4, 14, 2);
    const L = this.items();
    L.slice(this.top, this.top + this.rows).forEach((e, j) => { const i = this.top + j, y = 26 + j * 11; if (i === this.i) fill(2, y - 2, 152, 11, 1); if (e.icon && IMG[e.icon]) blit(spr(e.icon, 8, 8), 4, y); else text(e.main ? '*' : '!', 4, y, e.main ? 'gold' : 3); text(e.t.slice(0, 23), 14, y); });
    frame(2, 84, 156, 58); text(wrap(L[this.i].d, 24).slice(0, 5).join('\n'), 6, 88);
  }
}

// ================================================================ CRAFTING
class CraftScene extends ListScene {
  constructor() { super(8); this.pf = 0; }
  items() { return typeof craftList === 'function' ? craftList(this.pf) : RECIPES; }
  update() { if (P('select')) { SFX.page(); push(new BlueprintScene(this.pf)); return; } if (typeof CRAFT_PROFS !== 'undefined' && (P('left') || P('right'))) { this.pf = (this.pf + (P('left') ? CRAFT_PROFS.length - 1 : 1)) % CRAFT_PROFS.length; this.i = this.top = 0; SFX.page(); return; } this.navList(); if (P('b')) { SFX.back(); removeScene(this); return; } if (P('a')) { const r = craft(this.items()[this.i]); SFX[/^(Made|Forged)/.test(r) ? 'craft' : 'error'](); this.msg = r; } }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    { const k = typeof CRAFT_PROFS !== 'undefined' ? CRAFT_PROFS[this.pf] : 'ALL'; text(`<${k === 'ALL' ? 'ALL' : PROFS[k].slice(0, 9)} ${k === 'ALL' ? '' : G.prof[k]}> SEL:BLUEPRINT`, 2, 14, 2); }
    this.items().slice(this.top, this.top + this.rows).forEach((r, j) => { const i = this.top + j, y = 25 + j * 10, reduction = Math.floor(profTalentRank(r.prof, 'efficiency') / 24), known = G.blueprints.includes(r.id), ok = known && G.prof[r.prof] >= r.skill && Object.keys(r.needs).every(k => (G.inv[k] || 0) >= Math.max(1, r.needs[k] - reduction)); if (i === this.i) fill(2, y - 1, 152, 10, 1); blit(sprFit(ITEMS[r.makes].icon, 9), 4, y); text((known ? r.name : `? ${r.name}`).slice(0, 16), 16, y, ok ? 3 : known ? 1 : 2); textR(`${PROFS[r.prof].slice(0, 4)}${r.skill}`, 154, y, 2); });
    const r = this.items()[this.i]; if (!r) return; frame(2, 108, 156, 34);
    const reduction = Math.floor(profTalentRank(r.prof, 'efficiency') / 24);
    text(G.blueprints.includes(r.id) ? Object.entries(r.needs).map(([k, n]) => `${ITEMS[k].name.slice(0, 10)} ${G.inv[k] || 0}/${Math.max(1, n - reduction)}`).join('\n') : `BLUEPRINT UNKNOWN  COST ${recipeBlueprintCost(r)}G`, 6, 111);
    if (this.msg) textR(this.msg.slice(0, 14), 154, 131, 'gold');
  }
}

class BlueprintScene extends ListScene {
  constructor(pf = 0) { super(9); this.msg = ''; this.pf = pf; }
  items() { return typeof craftList === 'function' ? craftList(this.pf) : RECIPES; }
  update() {
    if (typeof CRAFT_PROFS !== 'undefined' && (P('left') || P('right'))) { this.pf = (this.pf + (P('left') ? CRAFT_PROFS.length - 1 : 1)) % CRAFT_PROFS.length; this.i = this.top = 0; SFX.page(); return; }
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const result = learnRecipeBlueprint(this.items()[this.i].id);
    SFX[result.startsWith('Learned') ? 'craft' : 'error'](); this.msg = result;
  }
  draw() {
    fill(0, 0, W, H, 0); hdr(); { const k = typeof CRAFT_PROFS !== 'undefined' ? CRAFT_PROFS[this.pf] : 'ALL'; textC(`< ${k === 'ALL' ? 'ALL BLUEPRINTS' : PROFS[k]} >`, 80, 14, 'gold'); }
    this.items().slice(this.top, this.top + this.rows).forEach((recipe, row) => {
      const index = this.top + row, y = 25 + row * 10, learned = G.blueprints.includes(recipe.id);
      if (index === this.i) fill(2, y - 1, 152, 10, 1);
      blit(sprFit(ITEMS[recipe.makes].icon, 9), 4, y);
      text((learned ? `KNOWN ${recipe.name}` : recipe.name).slice(0, 17), 16, y, learned ? 3 : 2);
      textR(`${recipe.skill}/${PROFS[recipe.prof].slice(0, 3)}`, 154, y, 2);
    });
    const recipe = this.items()[this.i]; if (!recipe) return; const cost = recipeBlueprintCost(recipe);
    frame(2, 108, 156, 34);
    text(`${PROFS[recipe.prof]} ${G.prof[recipe.prof]}/${recipe.skill}`, 6, 111, 2);
    text(G.blueprints.includes(recipe.id) ? 'ALREADY LEARNED' : `LEARN BLUEPRINT ${cost}G`, 6, 122, 'gold');
    if (this.msg) text(this.msg.slice(0, 25), 6, 132, 2);
  }
}

class ProfessionTreeScene extends ListScene {
  constructor() { super(4); this.professionIndex = 0; this.professionIds = Object.keys(PROFS); }
  professionId() { return this.professionIds[this.professionIndex]; }
  items() { return Object.entries(PROFESSION_TREES[this.professionId()]).map(([id, name]) => ({ id, name })); }
  pointsAvailable() { return Math.max(0, G.prof[this.professionId()] - professionTalentSpend(this.professionId())); }
  update() {
    if (P('select')) { this.professionIndex = (this.professionIndex + 1) % this.professionIds.length; this.i = this.top = 0; SFX.page(); }
    if (P('start')) { SFX.select(); push(new PerkTreeScene(this.professionId())); return; }
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const key = this.professionId(), branch = this.items()[this.i];
    if ((key === 'armorsmith' || key === 'weaponsmith') && G.lvl < 20) return say(`${PROFS[key]} unlocks at player level 20.`);
    const error = spendProfessionTalent(key, branch.id);
    if (error) { SFX.error(); say(error); }
    else { SFX.levelup(); }
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const key = this.professionId(), skill = G.prof[key] || 0, spent = professionTalentSpend(key);
    textC(`< ${PROFS[key]} >`, 80, 13, 'gold');
    text(`SKILL ${skill}/${PROF_CAP}`, 5, 27, 2);
    text(`TREE POINTS ${this.pointsAvailable()}`, 5, 37, 'gold');
    const branches = this.items();
    branches.forEach((branch, index) => {
      const y = 52 + index * 12, rank = profTalentRank(key, branch.id);
      if (index === this.i) fill(3, y - 1, 153, 11, 1);
      text(branch.name.slice(0, 19), 6, y);
      textR(`${rank}/240`, 151, y, rank >= 240 ? 'gold' : 2);
    });
    frame(2, 106, 156, 36);
    const selected = branches[this.i];
    const help = selected.id === 'yield' ? 'Every 24 ranks add one resource or crafted item.' : selected.id === 'efficiency' ? 'Every 24 ranks save one ingredient; blacksmiths also reduce tempering costs.' : 'Raises the chance to gain another profession skill level.';
    text(wrap(help, 24).slice(0, 2).join('\n'), 6, 111, 3);
    text('SELECT: JOB  START: PERKS', 4, 143, 1);
  }
}

class ProfessionQuestScene extends ListScene {
  constructor() { super(2); this.professionIndex = 0; this.professionIds = Object.keys(PROFS); this.message = ''; }
  professionId() { return this.professionIds[this.professionIndex]; }
  items() { return [{ id: 'side', name: 'PROFESSION SIDE QUEST' }, { id: 'order', name: 'REPEATABLE WORK ORDER' }]; }
  update() {
    if (P('select')) { this.professionIndex = (this.professionIndex + 1) % this.professionIds.length; this.i = this.top = 0; this.message = ''; SFX.page(); }
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const professionId = this.professionId(), questId = this.items()[this.i].id;
    if ((professionId === 'armorsmith' || professionId === 'weaponsmith') && G.lvl < 20) {
      this.message = `${PROFS[professionId]} UNLOCK AT PLAYER LEVEL 20.`; SFX.error(); return;
    }
    const status = professionQuestStatus(professionId, questId);
    if (status.done) { this.message = 'SIDE QUEST COMPLETE.'; SFX.cursor(); return; }
    if (status.ready) {
      const reward = claimProfessionQuest(professionId, questId);
      this.message = reward.ok ? `REWARD +${fmt(reward.xp)} XP +${fmt(reward.gold)}G +${reward.skill} SKILL` : 'QUEST IS NOT READY.';
      SFX[reward.ok ? 'quest_done' : 'error'](); return;
    }
    if (!status.accepted) {
      acceptProfessionQuest(professionId, questId);
      this.message = 'QUEST ACCEPTED. COMPLETE THE LISTED WORK.'; SFX.quest_accept(); return;
    }
    this.message = `PROGRESS ${status.progress}/${status.count}`; SFX.cursor();
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const professionId = this.professionId();
    textC(`< ${PROFS[professionId]} >`, 80, 13, 'gold');
    const locked = (professionId === 'armorsmith' || professionId === 'weaponsmith') && G.lvl < 20;
    text(`SKILL ${G.prof[professionId]}/${PROF_CAP}`, 5, 27, 2);
    this.items().forEach((quest, index) => {
      const status = professionQuestStatus(professionId, quest.id), y = 43 + index * 29;
      if (index === this.i) fill(3, y - 1, 153, 25, 1);
      const state = locked ? 'LOCKED' : status.done ? 'DONE' : status.ready ? 'READY' : status.accepted ? `${status.progress}/${status.count}` : 'NEW';
      text(quest.name.slice(0, 22), 6, y);
      textR(state, 151, y, status.ready ? 'gold' : status.done ? 2 : locked ? 1 : 3);
      text(wrap(status.text, 24).slice(0, 2).join('\n'), 6, y + 11, 2);
    });
    frame(2, 106, 156, 36);
    const selected = this.items()[this.i], status = professionQuestStatus(professionId, selected.id);
    text(this.message || (status.ready ? 'A: TURN IN' : status.accepted ? `${status.progress}/${status.count} COMPLETE` : 'A: ACCEPT'), 6, 110, status.ready ? 'gold' : 3);
    const rewardScale = selected.id === 'side' ? 3 : 1, reward = PROFESSION_QUESTS[professionId];
    text(`REWARD ${fmt(reward.xp * rewardScale)}XP ${fmt(reward.gold * rewardScale)}G`, 6, 121, 2);
    text(`+${reward.skill * rewardScale} PROF ${reward.item ? ITEMS[reward.item].name : ''}`.slice(0, 24), 6, 132, 2);
    text('SELECT: JOB', 4, 143, 1);
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
    ACHIEVEMENTS.slice(this.top, this.top + this.rows).forEach((a, j) => { const i = this.top + j, y = 25 + j * 10, got = !!G.ach[a.id]; if (i === this.i) fill(2, y - 1, 152, 10, 1); a.icon && IMG[a.icon] ? blit(spr(a.icon, 8, 8, { ghost: !got }), 4, y) : checkbox(4, y + 1, got); text(a.name.slice(0, 22), 14, y, got ? 3 : 1); });
    frame(2, 126, 156, 16); text(ACHIEVEMENTS[this.i].desc.slice(0, 24), 6, 130);
  }
}
class BossJournalScene extends ListScene {
  constructor() { super(8); this.category = 'ALL'; }
  items() { return this.category === 'NAMED' ? NAMED_ITEMS : BOSSES.filter(b => this.category === 'ALL' || b.cat === this.category); }
  update() {
    if (nav('left')) { const cats = ['ALL', 'world', 'dungeon', 'trial', 'tower', 'arc', 'raid', 'NAMED']; this.category = cats[(cats.indexOf(this.category) + cats.length - 1) % cats.length]; this.i = 0; this.top = 0; SFX.cursor(); }
    if (nav('right')) { const cats = ['ALL', 'world', 'dungeon', 'trial', 'tower', 'arc', 'raid', 'NAMED']; this.category = cats[(cats.indexOf(this.category) + 1) % cats.length]; this.i = 0; this.top = 0; SFX.cursor(); }
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); }
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const all = globalThis.GBQBossProgression ? globalThis.GBQBossProgression.summary(G, BOSSES) : { total: BOSSES.length, cleared: 0, percent: 0 };
    const rows = this.items(), namedMode = this.category === 'NAMED', b = rows[this.i] || BOSSES[0], state = !namedMode && G.bossProgress && G.bossProgress.clears && G.bossProgress.clears[b.id] || {}; 
    const namedFound = NAMED_ITEMS.filter(n => (G.named && G.named[n.id]) || (G.bossProgress && G.bossProgress.named && G.bossProgress.named[n.id])).length;
    text(namedMode ? `NAMED ${namedFound}/${NAMED_ITEMS.length}` : `BOSSES ${all.cleared}/${all.total} ${all.percent}%`, 4, 14, 'gold');
    text(`SIGILS ${G.bossTokens || 0}  ${this.category.toUpperCase()}`, 4, 23, 2);
    rows.slice(this.top, this.top + this.rows).forEach((entry, j) => {
      const i = this.top + j, y = 35 + j * 10, record = namedMode ? null : (G.bossProgress && G.bossProgress.clears && G.bossProgress.clears[entry.id]), owned = namedMode && !!((G.named && G.named[entry.id]) || (G.bossProgress && G.bossProgress.named && G.bossProgress.named[entry.id]));
      if (i === this.i) fill(2, y - 1, 154, 10, 1);
      const number = namedMode ? String(i + 1).padStart(3, '0') : String(BOSSES.indexOf(entry) + 1).padStart(3, '0');
      text(`${number} ${entry.name.slice(0, 15)}`, 5, y, (record && record.firstClear) || owned ? 'gold' : (i === this.i ? 3 : 1));
      textR(namedMode ? (owned ? `x${(G.named && G.named[entry.id]) || (G.bossProgress.named[entry.id])}` : '???') : (record ? `K${record.kills}` : 'NEW'), 153, y, (record && record.firstClear) || owned ? 2 : 1);
    });
    this.scrollbar(156, 34, 82);
    frame(2, 120, 156, 23);
    if (namedMode) {
      const owned = (G.named && G.named[b.id]) || (G.bossProgress && G.bossProgress.named && G.bossProgress.named[b.id]) || 0;
      text(`${b.kind.toUpperCase()}  ${b.src.raid ? 'RAID DROP' : b.src.act ? 'ARC DROP' : 'BOSS DROP'}`, 6, 124, 'gold');
      text(owned ? `DISCOVERED x${owned}` : 'NOT YET DISCOVERED', 6, 134, owned ? 'green' : 2);
    } else {
      text(`${b.cat.toUpperCase()} LV${b.lvl} RANK ${globalThis.GBQBossProgression ? globalThis.GBQBossProgression.rank(b) : 'F'}`, 6, 124, 'gold');
      text(`${state.firstClear ? 'CLEARED' : 'NOT DEFEATED'}  KILLS ${state.kills || 0}`, 6, 134, state.firstClear ? 'green' : 2);
    }
    text('LEFT/RIGHT: CATEGORY', 6, 146, 1);
  }
}
class SecretWorldJournalScene extends ListScene {
  constructor() { super(7); }
  items() { return globalThis.GBQSecretWorld ? globalThis.GBQSecretWorld.summary(G).entries : []; }
  update() { this.navList(); if (P('b') || P('start')) { SFX.back(); removeScene(this); } }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const data = globalThis.GBQSecretWorld.summary(G), entries = data.entries;
    text(`HIDDEN WORLD ${data.discovered}/${data.total}`, 4, 14, 'gold');
    entries.slice(this.top, this.top + this.rows).forEach((e, j) => {
      const i = this.top + j, y = 30 + j * 12;
      if (i === this.i) fill(3, y - 1, 154, 11, 1);
      text(`${String(i + 1).padStart(2, '0')} ${e.found ? e.name.slice(0, 19) : '???'}`, 6, y, e.found ? 'gold' : (i === this.i ? 3 : 1));
      textR(e.claimed ? 'CLAIMED' : e.entered ? 'OPENED' : e.found ? 'FOUND' : 'HIDDEN', 153, y, e.claimed ? 'green' : 1);
    });
    this.scrollbar(156, 29, 83);
    const e = entries[this.i];
    frame(3, 119, 154, 23);
    text(e.found ? e.hint : 'A secret remains concealed.', 7, 124, 2);
    text(e.found ? e.type.toUpperCase() + ' LV' + e.minLvl + '  +' + ((e.reward && e.reward.gold) || 0) + 'G' : 'Explore every region carefully.', 7, 134, 1);
  }
}
class EasterEggArchiveScene extends ListScene {
  constructor() { super(7); }
  items() { return globalThis.GBQEasterEggs ? globalThis.GBQEasterEggs.summary(G).entries : []; }
  update() { this.navList(); if (P('b') || P('start')) { SFX.back(); removeScene(this); } }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const data = globalThis.GBQEasterEggs.summary(G), entries = data.entries;
    text(`SECRETS ${data.discovered}/${data.total}`, 4, 14, 'gold');
    entries.slice(this.top, this.top + this.rows).forEach((e, j) => {
      const i = this.top + j, y = 30 + j * 12;
      if (i === this.i) fill(3, y - 1, 154, 11, 1);
      text(`${String(i + 1).padStart(2, '0')} ${e.found ? e.name : '???'}`, 6, y, e.found ? 'gold' : (i === this.i ? 3 : 1));
      textR(e.found ? 'FOUND' : 'HIDDEN', 153, y, e.found ? 'green' : 1);
    });
    this.scrollbar(156, 29, 83);
    const e = entries[this.i];
    frame(3, 119, 154, 23);
    text(e.found ? e.hint : 'A secret remains undiscovered.', 7, 124, 2);
    text(e.found ? `REWARD: ${e.reward.gold} GOLD` : 'Keep exploring and experimenting.', 7, 134, 1);
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
class RealmStoreScene extends ListScene {
  constructor() {
    super(5);
    this.products = [
      { name: 'STARFALL WARDEN OUTFIT', category: 'cosmetic' },
      { name: 'GLASSWING STAG MOUNT', category: 'cosmetic-mount' },
      { name: 'MOONLIT FOX PET', category: 'cosmetic-pet' },
      { name: 'VICTORY SALUTE EMOTE', category: 'cosmetic' },
      { name: 'EXTRA CHARACTER SLOT', category: 'account-service' },
    ];
    if (typeof LocalRealm !== 'undefined' && LocalRealm.available) LocalRealm.api('/api/store/catalog').then(catalog => {
      if (Array.isArray(catalog.products) && catalog.products.length) { this.products = catalog.products; this.i = Math.min(this.i, this.products.length - 1); }
    }).catch(() => {});
  }
  items() { return this.products.map(product => `${product.name.toUpperCase()} · PREVIEW`); }
  update() {
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('a')) say(['REALM STORE', 'PAYMENT CHECKOUT IS DISABLED.', 'No real-money purchases are available.', 'This product is preview only.']);
  }
  draw() {
    fill(0, 0, W, H, 0); hdr(); text('REALM STORE', 4, 14, 'gold');
    frame(2, 21, 156, 104); text('COSMETICS  /  ACCOUNT', 7, 25, 2);
    this.items().forEach((name, i) => { const y = 39 + i * 15; if (i === this.i) fill(5, y - 2, 148, 13, 1); text(name, 8, y, i === this.i ? 3 : 2); });
    frame(2, 128, 156, 16); textC('CHECKOUT DISABLED', 80, 132, 'red');
  }
}
class SocialScene extends ListScene {
  constructor() { super(8); this.lb = null; this.loading = false; }
  items() { return ['PARTY', 'FRIENDS', 'CREATE INVITE CODE', 'JOIN WITH CODE', 'TRADE', 'TRADING HUB', 'SERVER / MULTIPLAYER', 'LEADERBOARD', 'WHO (ONLINE)', 'GUILD', 'PET', 'REALM STORE', 'CHAT HELP']; }
  update() {
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const o = this.items()[this.i]; SFX.select();
    if (o === 'PARTY') push(new CompanionScene());
    if (o === 'FRIENDS') this.openFriends();
    if (o === 'CREATE INVITE CODE') this.createInvite();
    if (o === 'JOIN WITH CODE') this.joinInvite();
    if (o === 'TRADE') tradeMenu();
    if (o === 'TRADING HUB') push(new MarketScene());
    if (o === 'SERVER / MULTIPLAYER') serverMenu();
    if (o === 'LEADERBOARD') { this.loading = true; NET.leaderboard().then(r => { this.loading = false; const rows = (r && r.length ? r : realmPlayersIn('ardenhold').map(p => ({ name: p.name, lvl: p.lvl, cls: p.cls, ach: 0 }))).slice(0, 10); say([r && r.length ? 'REALM LEADERBOARD (LIVE)' : 'LEADERBOARD (OFFLINE SAMPLE)'].concat(rows.map((h, i) => `${i + 1}. ${clean(h.name)} LV${h.lvl} ${(CLASSES[h.cls] || { name: '' }).name.slice(0, 6)}`))); }); }
    if (o === 'WHO (ONLINE)') say([`LIVE PLAYERS: ${NET.peers.length} (${NET.status || 'OFFLINE'})`].concat(NET.peers.slice(0, 8).map(p => `${clean((p.presence || {}).n || 'HERO')} LV${(p.presence || {}).l || '?'}`)).concat([`REALM NPC HEROES: ${realmPlayersIn(G.map).length} here`]));
    if (o === 'GUILD') guildMenu();
    if (o === 'PET') { if (!G.pets.length) return say('No pets yet. Earn one at 100 kills.'); choose(G.pets.map(p => p.toUpperCase()).concat(['NONE']), i => { G.pet = i < G.pets.length && i >= 0 ? G.pets[i] : null; }); }
    if (o === 'REALM STORE') push(new RealmStoreScene());
    if (o === 'CHAT HELP') say(['CHAT: /s /y /p /g /w name /r /1 /2 /4 /e', 'SAY / YELL / PARTY / GUILD / WHISPER', 'WORLD / TRADE / LFG / EMOTE', 'Type /help for command help.']);
  }
  async openFriends() {
    if (!LocalRealm.available || !LocalRealm.account) return say('FRIEND LIST REQUIRES A REALM ACCOUNT. LOG IN AT TITLE > ACCOUNT.');
    try {
      const data = await LocalRealm.friends();
      const entries = data.friends.map(f => `${f.online ? 'ONLINE' : 'OFFLINE'}  ${f.name}`).concat(data.requests.map(f => `REQUEST  ${f.name}`));
      choose(['ADD FRIEND', ...entries, ...(data.friends.length ? ['REMOVE FRIEND'] : [])], i => {
        if (i === 0) {
          const name = window.prompt('Realm account name to add:');
          if (name) LocalRealm.requestFriend(name.trim()).then(r => say(r.accepted ? 'FRIEND REQUEST ACCEPTED.' : 'FRIEND REQUEST SENT.')).catch(e => say(e.message));
          return;
        }
        const idx = i - 1;
        if (idx >= data.friends.length && idx < data.friends.length + data.requests.length) {
          const f = data.requests[idx - data.friends.length];
          choose(['ACCEPT', 'DECLINE'], answer => {
            if (answer === 0) LocalRealm.acceptFriend(f.id).then(() => say(`${f.name} ADDED TO FRIENDS.`)).catch(e => say(e.message));
            else LocalRealm.removeFriend(f.id).catch(() => {});
          }, `FRIEND REQUEST FROM ${f.name}`);
        } else if (idx >= 0 && idx < data.friends.length) {
          const f = data.friends[idx]; say(`${f.name} IS ${f.online ? 'ONLINE' : 'OFFLINE'}.`);
        } else if (i === 1 + entries.length && data.friends.length) {
          choose(data.friends.map(f => f.name), j => { if (j >= 0) LocalRealm.removeFriend(data.friends[j].id).then(() => say('FRIEND REMOVED.')).catch(e => say(e.message)); }, 'REMOVE WHICH FRIEND?');
        }
      }, 'FRIENDS / REQUESTS');
    } catch (e) { say(`FRIENDS UNAVAILABLE: ${e.message}`); }
  }
  async createInvite() {
    try { const invite = await LocalRealm.createInvite(); say([`INVITE CODE: ${invite.code}`, 'Share this code with a friend.', 'It expires in 15 minutes.']); }
    catch (e) { say(`INVITE UNAVAILABLE: ${e.message}`); }
  }
  joinInvite() {
    const code = window.prompt('Enter your friend’s 8-character invite code:'); if (!code) return;
    LocalRealm.resolveInvite(code).then(invite => NET.joinServer(invite.peer)).catch(e => say(e.message));
  }
  draw() {
    fill(0, 0, W, H, 0); hdr(); textC('SOCIAL', 80, 13, 'gold');
    this.items().slice(this.top, this.top + this.rows).forEach((s, j) => { const i = this.top + j, y = 26 + j * 12; if (i === this.i) { fill(4, y - 2, 152, 12, 3); text(s, 10, y, 0); } else text(s, 10, y); });
    this.scrollbar(155, 26, 94);
    fill(2, 122, 156, 1, 2);
    text(`${modeOf().name}  NET: ${NET.status || 'OFFLINE'}`.slice(0, 25), 4, 125, 2);
    text((G.guild ? `<${G.guild}>` : 'NO GUILD').slice(0, 25), 4, 134, 2);
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
  constructor(homeKey = null) { super(8); this.side = 0; this.homeKey = homeKey; }
  storage() { return this.homeKey ? G.homes[this.homeKey].storage : G.bank; }
  limit() { return this.homeKey ? G.homes[this.homeKey].level * 20 : 60; }
  items() { return this.side ? this.storage() : G.bag; }
  update() {
    if (P('select')) { this.side ^= 1; this.i = this.top = 0; SFX.page(); }
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const L = this.items(), e = L[this.i]; if (!e) return;
    const dest = this.side ? G.bag : this.storage(), cap = this.side ? BAG_MAX : this.limit();
    if (dest.length >= cap) { SFX.error(); return say(this.side ? 'Your bag is full.' : 'This storage is full. Upgrade your home for more space.'); }
    L.splice(this.i, 1); dest.push(e); SFX.equip();
  }
  draw() {
    fill(0, 0, W, H, 0); hdr(); text(this.side ? `${this.homeKey ? 'HOUSE' : 'BANK'} ${this.storage().length}/${this.limit()} (A: withdraw)` : `BAG ${G.bag.length}/${BAG_MAX} (A: deposit)`, 4, 14, 'gold');
    this.items().slice(this.top, this.top + this.rows).forEach((e, j) => { const i = this.top + j, y = 25 + j * 11; if (i === this.i) fill(2, y - 1, 152, 11, 1); blit(sprFit(itemIcon(e), 9), 4, y); text(e.name.slice(0, 20), 16, y, rarityCol(e.rarity)); });
    text('SELECT: switch bag/bank', 6, 134, 1);
  }
}

class HousingScene extends ListScene {
  constructor(key = G.map) { super(5); this.key = key; this.zone = ZONE_BY_ID[key]; }
  home() { return G.homes[this.key]; }
  purchasePrice() { return this.zone && this.zone.town ? 500 : 250; }
  upgradePrice() { const home = this.home(); return home ? home.level * 300 : 0; }
  items() { return this.home() ? ['ENTER HOME', `UPGRADE STORAGE (${this.home().level >= 5 ? 'MAX' : this.upgradePrice() + 'G'})`, 'LEAVE'] : [`BUY HOME (${this.purchasePrice()}G)`, 'LEAVE']; }
  update() {
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    if (!this.home()) {
      if (this.i === 0) {
        const cost = this.purchasePrice();
        if (G.gold < cost) { SFX.error(); return say(`A home here costs ${cost} G.`); }
        G.gold -= cost; G.homes[this.key] = { level: 1, decor: [], storage: [] }; SFX.buy(); saveGame(); toast('NEW HOME', this.zone.name, 'item_chest', 'achievement');
      } else { removeScene(this); SFX.back(); }
      return;
    }
    if (this.i === 0) { push(new HomeInteriorScene(this.key)); return; }
    if (this.i === 1) {
      const home = this.home();
      if (home.level >= 5) { SFX.error(); return say('Your house storage is fully upgraded.'); }
      const cost = this.upgradePrice();
      if (G.gold < cost) { SFX.error(); return say(`The storage upgrade costs ${cost} G.`); }
      G.gold -= cost; home.level++; SFX.buy(); saveGame(); toast('HOME UPGRADED', `STORAGE ${home.level * 20}`, 'item_chest', 'achievement');
    } else { removeScene(this); SFX.back(); }
  }
  draw() {
    fill(0, 0, W, H, 0); hdr(); textC('SETTLEMENT HOUSING', 80, 14, 'gold');
    const home = this.home(); textC(this.zone ? this.zone.name : this.key, 80, 27, 2);
    const options = this.items(); options.forEach((option, index) => { const y = 48 + index * 18; if (index === this.i) fill(8, y - 2, 144, 14, 1); text(option.slice(0, 24), 13, y, index === this.i ? 3 : 2); });
    if (home) textC(`HOUSE LEVEL ${home.level}  CHEST ${home.level * 20}`, 80, 133, 2);
    else textC(`A home costs ${this.purchasePrice()} gold.`, 80, 133, 2);
  }
}

class HomeInteriorScene extends ListScene {
  constructor(homeKey) { super(5); this.homeKey = homeKey; }
  home() { return G.homes[this.homeKey]; }
  items() { return ['REST AT HOME', 'OPEN STORAGE', 'DECORATE HOME', 'BIND HEARTHSTONE', 'RETURN OUTSIDE']; }
  update() {
    this.navList();
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const home = this.home();
    if (this.i === 0) { longRest(G); G.companions.forEach(longRest); G.ghost = null; saveGame(); SFX.heal(); toast('HOME REST', 'You feel rested and ready.', 'px_tent', 'heal'); }
    if (this.i === 1) push(new BankScene(this.homeKey));
    if (this.i === 2) {
      const choices = [['study', 'STUDY DESK', 250], ['trophy', 'TROPHY CASE', 180], ['garden', 'WINDOW GARDEN', 150], ['banner', 'HOUSE BANNER', 120]];
      choose(choices.map(([, name, price]) => `${name} (${price}G)`), index => {
        if (index < 0) return;
        const [id, name, price] = choices[index];
        if (home.decor.includes(id)) return say(`You already have a ${name.toLowerCase()}.`);
        if (home.decor.length >= home.level + 1) return say('No room for more furnishings. Upgrade your home first.');
        if (G.gold < price) return say(`${name} costs ${price} G.`);
        G.gold -= price; home.decor.push(id); SFX.buy(); saveGame(); toast('FURNISHED', name, 'item_chest', 'achievement');
      }, 'Choose a furnishing.');
    }
    if (this.i === 3) { G.hearth = { map: this.homeKey, x: 16, y: 12 }; saveGame(); SFX.confirm(); toast('HEARTH BOUND', ZONE_BY_ID[this.homeKey]?.name || 'HOME', 'px_waypoint', 'waypoint'); }
    if (this.i === 4) { removeScene(this); SFX.back(); }
  }
  draw() {
    fill(0, 0, W, H, 0); fill(0, 0, W, 11, 0); hdr();
    textC(`${ZONE_BY_ID[this.homeKey]?.name || 'HOME'} HOME`, 80, 14, 'gold');
    fill(7, 30, 146, 77, '#594332'); fill(11, 34, 138, 68, '#b58a5e');
    fill(15, 86, 130, 13, '#784d48'); fill(18, 89, 124, 7, '#a46d62');
    fill(20, 59, 29, 22, '#6d4d3a'); fill(22, 56, 25, 15, '#e0c99b'); fill(18, 77, 33, 5, '#4a3026');
    fill(111, 81, 25, 18, '#79512e'); fill(114, 77, 19, 8, '#a67742');
    textC('BED', 34, 67, 0); textC('CHEST', 123, 87, 0);
    this.home().decor.forEach((id, index) => { const x = 16 + (index % 4) * 35, y = 43 + Math.floor(index / 4) * 15; fill(x, y, 29, 10, id === 'garden' ? 'green' : id === 'banner' ? 'red' : 'gold'); textC(({ study: 'BOOKS', trophy: 'CUP', garden: 'LEAF', banner: 'FLAG' })[id] || id, x + 14, y + 1, 0); });
    this.items().forEach((option, index) => { const y = 103 + index * 7; if (index === this.i) fill(4, y - 1, 152, 8, 1); text(option.slice(0, 24), 7, y, index === this.i ? 'gold' : 3); });
    textC(`CHEST ${this.home().storage.length}/${this.home().level * 20}  DECOR ${this.home().decor.length}/${this.home().level + 1}`, 80, 141, 2);
  }
}

// ================================================================ SETTINGS & SOUND TEST
class SettingsScene extends ListScene {
  constructor() { super(11); }
  navList() { const n = this.items().length; if (nav('up')) { this.i = (this.i + n - 1) % n; SFX.cursor(); } if (nav('down')) { this.i = (this.i + 1) % n; SFX.cursor(); } }
  items() { return ['CHAT SETTINGS', 'UI THEME', 'BATTLE BG', 'NETWORK', 'PALETTE', 'VIDEO', 'HD RESOLUTION', 'FRAME RATE', 'TILES', 'ART', 'CITADEL ART', 'AUDIO', 'SFX VOLUME', 'MUSIC VOLUME', 'BRIGHTNESS', 'CONTRAST', 'TEXT SPEED', 'WEATHER', 'AUTO BATTLE', 'COMBAT MODE', 'SWAP A/B', 'DIFFICULTY', 'SOUND TEST', 'ABOUT', 'DISPLAY MODE', 'KEY BINDINGS', 'HOVER TOOLTIPS', 'RIGHT-CLICK TOOLTIPS']; }
  update() {
    this.navList();
    if (P('b')) { saveSettings(); SFX.back(); removeScene(this); return; }
    if (this.items()[this.i] === 'KEY BINDINGS' && P('a')) { push(new KeybindScene()); SFX.confirm(); return; }
    if (this.items()[this.i] === 'CHAT SETTINGS' && P('a') && typeof ChatSettingsScene === 'function') { push(new ChatSettingsScene()); SFX.confirm(); return; }
    const d = nav('right') || P('a') ? 1 : nav('left') ? -1 : 0; if (!d) return;
    const o = this.items()[this.i], clamp = v => Math.max(0, Math.min(6, v));
    if (o === 'DISPLAY MODE') {
      const modes = ['windowed', 'full-window', 'borderless', 'fullscreen'], k = modes.indexOf(S.displayMode);
      applyDisplayMode(modes[(k + (d > 0 ? 1 : modes.length - 1)) % modes.length]); SFX.toggle(); return;
    }
    if (o === 'HOVER TOOLTIPS') S.tooltipHover = S.tooltipHover !== false ? false : true;
    if (o === 'RIGHT-CLICK TOOLTIPS') S.tooltipRightClick = S.tooltipRightClick !== false ? false : true;
    if (o === 'BATTLE BG') { S.battleBg = typeof nextBattleBg === 'function' ? nextBattleBg(S.battleBg || 'clean') : S.battleBg === 'painted' ? 'clean' : 'painted'; }
    if (o === 'UI THEME') { if (typeof nextUiTheme === 'function') S.uiTheme = nextUiTheme(S.uiTheme, d); else { const themes = ['classic', 'sanctum', 'diablo']; const k = themes.indexOf(S.uiTheme || 'classic'); S.uiTheme = themes[(k + (d > 0 ? 1 : themes.length - 1)) % themes.length]; } clearCaches(); }
    if (o === 'PALETTE') { const k = PAL_ORDER.indexOf(S.palette); S.palette = PAL_ORDER[(k + (d > 0 ? 1 : PAL_ORDER.length - 1)) % PAL_ORDER.length]; UI = PALS[S.palette]; clearCaches(); }
    if (o === 'NETWORK') { NET.setMode(NET.offline ? 'online' : 'offline'); }
    if (o === 'HD RESOLUTION') { const options = ['native', '4k', '8k'], k = options.indexOf(S.hdRes); S.hdRes = options[(k + (d > 0 ? 1 : options.length - 1)) % options.length]; }
    if (o === 'FRAME RATE') { const options = [12, 60, 240], k = options.indexOf(Number(S.fps)); S.fps = options[(k + (d > 0 ? 1 : options.length - 1)) % options.length]; }
    if (o === 'AUDIO') { S.audio = S.audio === 'hd64' ? 'chip' : 'hd64'; const c = Music.cur; Music.cur = null; Music.step = 0; if (c) Music.play(c); }
    if (o === 'VIDEO') { if (S.video === 'hd64') { S.video = 'gb'; S.palette = S.palPrev || 'gbc'; } else { S.video = 'hd64'; S.palPrev = S.palette; S.palette = 'full'; } UI = PALS[S.palette]; clearCaches(); }
    if (o === 'ART') { S.art = ({ classic: 'nes', nes: 'packs', packs: 'classic' })[S.art] || 'nes'; if (typeof applyPackArt === 'function') applyPackArt(); applyArt(); clearCaches(); }
    if (o === 'CITADEL ART') { S.citadelArt = S.citadelArt === false; clearCaches(); }
    if (o === 'TILES') S.tiles = S.tiles === 'painted' ? 'pixel' : 'painted';
    if (o === 'SFX VOLUME') S.vol = clamp(S.vol + d);
    if (o === 'MUSIC VOLUME') S.music = clamp(S.music + d);
    if (o === 'BRIGHTNESS') S.bright = clamp(S.bright + d);
    if (o === 'CONTRAST') S.contrast = clamp(S.contrast + d);
    if (o === 'TEXT SPEED') S.textSpeed = Math.max(0, Math.min(3, S.textSpeed + d));
    if (o === 'WEATHER') S.weather = !S.weather;
    if (o === 'AUTO BATTLE') S.autoBattle = !S.autoBattle;
    if (o === 'COMBAT MODE') S.combatMode = S.combatMode === 'realtime' ? 'turn-based' : 'realtime';
    if (o === 'SWAP A/B') S.swap = !S.swap;
    if (o === 'DIFFICULTY' && G) { difficultyMenu(); return; }
    if (o === 'SOUND TEST' && P('a')) { push(new SoundTest()); return; }
    if (o === 'ABOUT' && P('a')) { say([`${BUILD.game}: ${BUILD.subtitle}`, `Version ${BUILD.version} build ${BUILD.build}`, `A game by ${BUILD.studio}`, 'EXPANSIONS:', ...BUILD.expansions, `${ZONES.length} zones, ${BESTIARY.length} creatures, ${BOSSES.length} bosses, ${SPELLS.length} spells, ${SFX_NAMES.length} sound effects, ${Object.keys(TRACKS).length} music tracks.`]); return; }
    saveSettings(); SFX.toggle();
  }
  draw() {
    fill(0, 0, W, H, 0); if (G) hdr(); else { fill(0, 0, W, 11, 0); if (S.uiTheme === 'blackbird' && IMG.bb_title) ctx.drawImage(IMG.bb_title, 0, 0, W, 12); }
    if (S.uiTheme === 'blackbird' && !G) frame(1, 12, 158, 130);
    textC('SETTINGS', 80, 13, 'gold');
    const v = ['OPEN', ({ mmo: '8-BIT MMO', classic: 'CLASSIC', sanctum: 'SANCTUM', diablo: 'DIABLO IV', blackbird: 'BLACKBIRD' })[S.uiTheme] || 'CLASSIC', (S.battleBg || 'clean').toUpperCase(), NET.offline ? 'OFFLINE' : 'ONLINE', PALS[S.palette].name, S.video === 'hd64' ? '64-BIT' : 'GAME BOY', ({ native: 'NATIVE', '4k': '4K UPSCALE', '8k': '8K UPSCALE' })[S.hdRes] || 'NATIVE', `${S.fps} FPS`, S.tiles === 'painted' ? 'PAINTED' : 'PIXEL', S.art === 'classic' ? 'CLASSIC' : S.art === 'packs' ? 'PIXEL PACKS' : 'NES', S.citadelArt === false ? 'OFF' : 'ON', S.audio === 'hd64' ? '64-BIT' : 'CHIP 4CH', S.vol, S.music, S.bright, S.contrast, ['SLOW', 'NORMAL', 'FAST', 'INSTANT'][S.textSpeed], S.weather ? 'ON' : 'OFF', S.autoBattle ? 'ON' : 'OFF', S.combatMode === 'realtime' ? 'REAL-TIME' : 'TURN-BASED', S.swap ? 'ON' : 'OFF', G ? diffOf().name : '-', '>', ({ windowed: 'WINDOWED', 'full-window': 'FULL WINDOW', borderless: 'BORDERLESS', fullscreen: 'FULL SCREEN' })[S.displayMode] || 'WINDOWED', '>', S.tooltipHover === false ? 'OFF' : 'ON', S.tooltipRightClick === false ? 'OFF' : 'ON'];
    this.top = Math.max(0, Math.min(this.i - 5, this.items().length - 11)); this.items().slice(this.top, this.top + 11).forEach((s, j) => { const i = this.top + j, y = 24 + j * 10; if (i === this.i) fill(2, y - 1, 156, 10, 1); text(s, 6, y); typeof v[i] === 'number' ? segBar(108, y + 1, v[i], 6) : textR(String(v[i]), 154, y, 2); });
  }
}
class KeybindScene extends ListScene {
  constructor() { super(8); this.actions = [['up', 'MOVE UP'], ['down', 'MOVE DOWN'], ['left', 'MOVE LEFT'], ['right', 'MOVE RIGHT'], ['a', 'CONFIRM / ATTACK'], ['b', 'BACK / CANCEL'], ['start', 'MENU'], ['select', 'SECONDARY']]; this.capture = null; }
  items() { return this.actions.map(([, label]) => label).concat(['RESTORE DEFAULTS']); }
  update() {
    this.navList();
    if (P('b') && !this.capture) { SFX.back(); removeScene(this); return; }
    if (!P('a') || this.capture) return;
    if (this.i === this.actions.length) { S.keybinds = Object.assign({}, DEFAULT_KEYBINDS); saveSettings(); SFX.confirm(); return; }
    this.capture = this.actions[this.i][0]; keyCaptureHandler = code => {
      if (!code || code === 'Unidentified') return;
      const action = this.capture, previous = S.keybinds[action], owner = this.actions.find(([key]) => key !== action && S.keybinds[key] === code);
      if (owner) S.keybinds[owner[0]] = previous;
      S.keybinds[action] = code; this.capture = null; keyCaptureHandler = null; saveSettings(); SFX.confirm();
    };
    SFX.confirm();
  }
  draw() {
    fill(0, 0, W, H, 0); if (G) hdr(); else { fill(0, 0, W, 11, 0); if (S.uiTheme === 'blackbird' && IMG.bb_title) ctx.drawImage(IMG.bb_title, 0, 0, W, 12); }
    if (S.uiTheme === 'blackbird' && !G) frame(1, 12, 158, 130);
    textC('KEY BINDINGS', 80, 13, 'gold');
    this.actions.forEach(([action, label], index) => { const y = 29 + index * 12; if (index === this.i) fill(3, y - 2, 154, 11, 1); text(label, 7, y); textR(this.capture === action ? 'PRESS KEY…' : keyLabel(S.keybinds[action]), 151, y, this.capture === action ? 'gold' : 2); });
    const y = 29 + this.actions.length * 12; if (this.i === this.actions.length) fill(3, y - 2, 154, 11, 1); text('RESTORE DEFAULTS', 7, y, this.i === this.actions.length ? 3 : 2);
    textC(this.capture ? 'PRESS A KEY  •  ESC ALSO WORKS' : 'ENTER: CHANGE  B: BACK', 80, 132, 2);
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
    fill(0, 0, W, H, 0);
    if (S.uiTheme === 'blackbird' && IMG.bb_title) ctx.drawImage(IMG.bb_title, 0, 0, W, 12); else fill(0, 0, W, 11, 3);
    if (S.uiTheme === 'blackbird' && !G) frame(1, 12, 158, 130);
    textC((S.audio === 'hd64' ? '64-BIT ' : 'CHIP ') + (this.tab ? `MUSIC ${Object.keys(TRACKS).length}` : `SFX ${this.items().length}`), 80, 1, S.uiTheme === 'blackbird' ? 'gold' : 0);
    this.items().slice(this.top, this.top + this.rows).forEach((s, j) => { const i = this.top + j, y = 15 + j * 11; if (i === this.i) fill(2, y - 1, 152, 11, 1); text(`${String(i + 1).padStart(3, '0')} ${s.toUpperCase()}`, 6, y); });
    this.scrollbar(156, 14, 110);
    text('A:PLAY SEL:SFX/MUSIC START:ENGINE', 2, 134, 2);
  }
}
