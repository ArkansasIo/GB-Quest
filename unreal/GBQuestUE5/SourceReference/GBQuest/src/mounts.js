// ================================================================ MOUNTS: 120 to collect
// 12 families x 10 coats (data: src/mount_data.js, art: assets/mt_*.png from tools/gen_mounts.py).
// FIRST MOUNT: at level 15, the stablemaster in Ardenhold (the first town) offers a starter steed, warwolf
// or raptor for 100 G, and teaches riding. After that, mounts come from:
//   stable       steeds, warwolves, raptors, warboars, mountain rams: bought (level-gated)
//   reputation   great stags: sold once you are HONORED with any faction
//   dungeon      war bears, sabrecats: 4% from dungeon bosses
//   crafted      clockwork striders: built by a craft master with blacksmithing and salvage
//   worldboss    spectral steeds: 6% from world bosses
//   raid         gryphons and drakes (flying, fastest): 8% from raid bosses
//   achievement  the SHADOW and CELESTIAL coats of the ground families: claim with 10 / 20 achievements
// Tiers: 1 ground (fast, 0.6x encounters), 2 swift (0.45x), 3 flying (double speed, 0.3x).

const MOUNT_BY_ID = Object.fromEntries(MOUNTS.map(m => [m.id, m]));
const STARTER_MOUNTS = ['steed_brown', 'warwolf_grey', 'raptor_brown'];
const MOUNT_SOURCE_NAME = { stable: 'STABLE', reputation: 'REPUTATION', dungeon: 'DUNGEON DROP', crafted: 'CRAFTED', worldboss: 'WORLD BOSS', raid: 'RAID DROP', achievement: 'ACHIEVEMENT' };
function mountsOwned() {
  if (!Array.isArray(G.mounts)) G.mounts = [];
  if (G.hasMount && !G.mounts.length) G.mounts.push('raptor_brown'); // riders from before the collection
  if (G.mounts.length && !MOUNT_BY_ID[G.mount]) G.mount = G.mounts[0];
  return G.mounts;
}
const curMount = () => (mountsOwned(), MOUNT_BY_ID[G.mount] || null);
function grantMount(id, why) {
  const m = MOUNT_BY_ID[id]; if (!m || mountsOwned().includes(id)) return false;
  G.mounts.push(id); G.hasMount = true; if (!G.mount) G.mount = id;
  G.stats.mounts = G.mounts.length;
  toast('NEW MOUNT!', m.name.slice(0, 22), `mt_${id}`, 'achievement');
  if (why) say([`NEW MOUNT: ${m.name}`, why, 'Choose it in STABLE > COLLECTION or MENU > MOUNTS.']);
  return true;
}
// mounted speed and encounter rate come from the active mount
const mountSpeed = () => { const m = curMount(); return m ? m.speed : 4; };
const mountEnc = () => { const m = curMount(); return m ? m.enc : 0.6; };
// drops from bosses
{
  const rv0 = recordVictory;
  recordVictory = function (b) {
    rv0(b);
    const boss = b.foes.find(f => f.bossId || f.boss); if (!boss) return;
    const bd = boss.bossId ? BOSS_BY_ID[boss.bossId] : null, inst = G.inst ? G.inst.kind : null;
    const pool = src => MOUNTS.filter(m => m.source === src && m.lvl <= G.lvl + 20 && !mountsOwned().includes(m.id));
    let src = null, chance = 0;
    if (inst === 'raid' || (bd && bd.cat === 'raid')) { src = 'raid'; chance = 0.08; }
    else if (bd && bd.cat === 'world') { src = 'worldboss'; chance = 0.06; }
    else if (inst === 'dungeon' || inst === 'tower') { src = 'dungeon'; chance = 0.04; }
    if (!src || R() >= chance) return;
    const p = pool(src); if (p.length) grantMount(pick(p).id, `It came from ${boss.name}.`);
  };
}

// ---------------------------------------------------------------- stablemaster
function stableMenu() {
  mountsOwned();
  const first = !G.mounts.length;
  const opts = first ? [`FIRST MOUNT (LV15)`, 'COLLECTION', 'LEAVE'] : ['BUY MOUNTS', 'COLLECTION', 'CLAIM REWARDS', 'LEAVE'];
  choose(opts, k => {
    const o = opts[k];
    if (o === 'FIRST MOUNT (LV15)') {
      if (G.lvl < 15) return say(['Come back at level 15.', 'Then I will teach you to ride and give you your first mount.']);
      if (G.gold < 100) return say('Your first mount costs 100 G, saddle included.');
      choose(STARTER_MOUNTS.map(id => MOUNT_BY_ID[id].name), j => {
        if (j < 0) return; G.gold -= 100; grantMount(STARTER_MOUNTS[j]); G.mount = STARTER_MOUNTS[j]; SFX.howl(); saveGame();
        say(['You learn to ride!', `${MOUNT_BY_ID[STARTER_MOUNTS[j]].name} is yours.`, 'Press B in the field to mount up.']);
      }, 'Pick your first mount: a steady steed, a loyal warwolf or a quick raptor.');
    }
    if (o === 'BUY MOUNTS') {
      const honored = Object.values(G.rep || {}).some(v => v >= 900);
      const shop = MOUNTS.filter(m => (m.source === 'stable' || (m.source === 'reputation' && honored)) && !G.mounts.includes(m.id)).sort((a, b) => a.lvl - b.lvl).slice(0, 10);
      if (!shop.length) return say('You own every mount I sell.');
      choose(shop.map(m => `${m.name.slice(0, 13)} L${m.lvl} ${fmt(m.price || 500)}G`), j => {
        if (j < 0) return; const m = shop[j], price = m.price || 500;
        if (G.lvl < m.lvl) return say(`${m.name} needs level ${m.lvl}.`);
        if (G.gold < price) return say('Not enough gold.');
        G.gold -= price; grantMount(m.id); SFX.buy(); saveGame(); say(`${m.name} joins your stable.`);
      }, honored ? 'Great stags are for sale to friends of the factions.' : 'Earn HONORED with a faction to buy great stags.');
    }
    if (o === 'COLLECTION') push(new MountScene());
    if (o === 'CLAIM REWARDS') {
      const ach = Object.keys(G.ach || {}).length, got = [];
      for (const m of MOUNTS.filter(m => m.source === 'achievement' && !G.mounts.includes(m.id))) { const need = m.variant === 'SHADOW' ? 10 : 20; if (ach >= need && G.lvl >= m.lvl) { grantMount(m.id); got.push(m.name); } }
      saveGame(); say(got.length ? ['Your deeds are rewarded:'].concat(got.slice(0, 6)) : [`Achievements: ${ach}. SHADOW coats need 10, CELESTIAL coats 20 (and their level).`]);
    }
  }, `STABLEMASTER: ${G.mounts.length}/${MOUNTS.length} MOUNTS.`);
}
// clockwork striders: built by any craft master
function buildClockwork() {
  const opts = MOUNTS.filter(m => m.source === 'crafted' && !mountsOwned().includes(m.id)).slice(0, 8);
  if (!opts.length) return say('You have built every clockwork strider.');
  choose(opts.map(m => `${m.name.slice(0, 14)} L${m.lvl}`), j => {
    if (j < 0) return; const m = opts[j], need = { scrap: 20 + m.lvl / 5 | 0, iron_ore: 10 + m.lvl / 10 | 0 }, skill = Math.min(600, m.lvl * 2);
    if ((G.prof.blacksmith || 0) < skill) return say(`Needs BLACKSMITHING ${skill}.`);
    for (const k in need) if ((G.inv[k] || 0) < need[k]) return say(`Needs ${need.scrap} scrap iron and ${need.iron_ore} iron ore.`);
    for (const k in need) for (let i = 0; i < need[k]; i++) takeItem(k);
    grantMount(m.id, 'Gears click, steam hisses. It walks!'); SFX.craft(); saveGame();
  }, 'Clockwork striders: blacksmithing, scrap iron and iron ore.');
}
{
  const cm0 = craftMasterMenu;
  craftMasterMenu = function (e) {
    if (!(G.prof.blacksmith > 0) || G.lvl < 60) return cm0(e);
    choose(['SMITHING', 'BUILD CLOCKWORK MOUNT', 'LEAVE'], k => { if (k === 0) cm0(e); if (k === 1) buildClockwork(); }, 'CRAFT MASTER');
  };
}

// ---------------------------------------------------------------- collection screen
class MountScene {
  constructor() { this.opaque = true; this.i = Math.max(0, MOUNTS.findIndex(m => m.id === G.mount)); this.top = 0; }
  update() {
    if (P('b')) { SFX.back(); removeScene(this); return; }
    const n = MOUNTS.length;
    if (nav('up')) { this.i = (this.i + n - 1) % n; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % n; SFX.cursor(); }
    if (nav('left')) { this.i = Math.max(0, this.i - 10); SFX.cursor(); }
    if (nav('right')) { this.i = Math.min(n - 1, this.i + 10); SFX.cursor(); }
    if (this.i < this.top) this.top = this.i; if (this.i > this.top + 6) this.top = this.i - 6;
    if (P('a')) { const m = MOUNTS[this.i]; if (mountsOwned().includes(m.id)) { G.mount = m.id; SFX.howl(); saveGame(); } else SFX.error(); }
  }
  draw() {
    fill(0, 0, W, H, 0); fill(0, 0, W, 11, 3);
    textC(`MOUNTS ${mountsOwned().length}/${MOUNTS.length}`, 80, 1, 'gold');
    MOUNTS.slice(this.top, this.top + 7).forEach((m, j) => {
      const i = this.top + j, y = 14 + j * 11, own = G.mounts.includes(m.id);
      if (i === this.i) fill(1, y - 1, 92, 11, 1);
      text(m.id === G.mount ? '*' : ' ', 2, y, 'gold');
      text(m.name.slice(0, 13), 9, y, own ? 3 : 1);
    });
    const m = MOUNTS[this.i], own = G.mounts.includes(m.id);
    frame(95, 13, 64, 64);
    const sp = sprFit('mt_' + m.id, 44, own ? undefined : { ghost: true }); if (sp) blit(sp, 127 - sp.width / 2, 22);
    text(['', 'GROUND', 'SWIFT', 'FLYING'][m.tier], 99, 66, m.tier === 3 ? 'gold' : 2);
    frame(1, 92, 158, 51);
    text(`${m.name}`.slice(0, 25), 5, 95, own ? 'gold' : 3);
    text(`${MOUNT_SOURCE_NAME[m.source]}  LV${m.lvl}${m.price ? '  ' + fmt(m.price) + 'G' : ''}`.slice(0, 25), 5, 105, 2);
    text(wrap(m.desc, 25)[0], 5, 115, 3);
    text(own ? (m.id === G.mount ? 'ACTIVE MOUNT' : 'A: RIDE THIS ONE') : 'NOT OWNED  L/R: PAGE', 5, 132, own ? 'green' : 1);
  }
}
