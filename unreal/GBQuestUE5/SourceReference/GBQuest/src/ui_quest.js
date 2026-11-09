'use strict';
// ================================================================ QUEST WINDOWS UI THEME (classic 8-bit console RPG)
// SETTINGS > UI THEME: QUEST WINDOWS. The look of the early console RPGs:
//   * every window, menu and dialog: solid black with a thin white rounded border and white text
//   * a STATUS window (name, LV, HP, MP, G, E) that appears when you stand still on the field
//   * a COMMAND window: press A where there is nothing to talk to or use
//       TALK  STATUS  ITEM  SPELL  SEARCH  EQUIP  STAIRS  MAP
//     SEARCH looks around your feet (sometimes coins or a herb, once a day per spot); STAIRS uses the stairs
//     you stand on. The rest open the existing screens.
// Wraps col/frame/bar/hdr after the other themes, so every existing screen follows without changes.

const QUEST_SHADES = [[0, 0, 0], [92, 92, 104], [180, 180, 190], [255, 255, 255]];
const questUi = () => S.uiTheme === 'quest' && !MONO(S.palette);
const QUEST_COMMANDS = ['TALK', 'STATUS', 'ITEM', 'SPELL', 'SEARCH', 'EQUIP', 'STAIRS', 'MAP'];

function questWindow(x, y, w, h, title) {
  fill(x, y, w, h, '#000');
  if (w >= 6 && h >= 6) {
    fill(x + 2, y + 1, w - 4, 1, '#fff'); fill(x + 2, y + h - 2, w - 4, 1, '#fff');
    fill(x + 1, y + 2, 1, h - 4, '#fff'); fill(x + w - 2, y + 2, 1, h - 4, '#fff');
  }
  if (title) { const tw = String(title).length * 6 + 4; fill(x + ((w - tw) >> 1), y, tw, 3, '#000'); textC(title, x + (w >> 1), y - 3, 3); }
}

{
  const col1 = col;
  col = function (c) { if (typeof c === 'number' && questUi()) { const k = QUEST_SHADES[c] || QUEST_SHADES[3]; return `rgb(${k[0]},${k[1]},${k[2]})`; } return col1(c); };
  const frame1 = frame;
  frame = function (x, y, w, h, bg = 0) { if (!questUi()) return frame1(x, y, w, h, bg); questWindow(x, y, w, h); };
  const bar1 = bar;
  bar = function (x, y, w, h, v, max, c = 2) {
    if (!questUi()) return bar1(x, y, w, h, v, max, c);
    fill(x, y, w, h, '#fff'); fill(x + 1, y + 1, w - 2, h - 2, '#000');
    const f = Math.round((w - 2) * Math.max(0, Math.min(1, max ? v / max : 0)));
    if (f > 0) fill(x + 1, y + 1, f, h - 2, col(c));
  };
  const hdr1 = hdr;
  hdr = function () {
    if (!questUi()) return hdr1();
    fill(0, 0, W, 11, '#000'); fill(0, 10, W, 1, '#fff');
    if (G) { text(`LV${G.lvl}`, 3, 1, 3); textR(`G ${G.gold}`, W - 3, 1, 3); }
  };
}

// the classic status window, shown after standing still for a moment
function questStatusWindow(field) {
  if (!G || !field) return;
  const D = derive(G), mp = typeof resourceFrac === 'function' ? Math.round(resourceFrac(G) * 100) : 0;
  const x = 3, y = 6, w = 54, h = 56;
  questWindow(x, y, w, h, String(G.name || 'HERO').slice(0, 7));
  const rows = [['LV', G.lvl], ['HP', G.hp], ['MP', `${mp}%`], ['G', G.gold], ['E', G.xp || 0]];
  rows.forEach(([k, v], i) => { text(k, x + 5, y + 6 + i * 10, 3); textR(String(v).slice(0, 6), x + w - 5, y + 6 + i * 10, 3); });
  if (G.hp < D.hpMax * 0.25 && (frameN >> 4) % 2) fill(x + 2, y + 2, w - 4, 1, '#f44');
}

class QuestCommand {
  constructor(field) { this.field = field; this.i = 0; }
  update() {
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (nav('up')) { this.i = (this.i + 6) % 8; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 2) % 8; SFX.cursor(); }
    if (nav('left') || nav('right')) { this.i ^= 1; SFX.cursor(); }
    if (!P('a')) return;
    SFX.select(); removeScene(this);
    questCommand(QUEST_COMMANDS[this.i], this.field);
  }
  draw() {
    const x = W - 76, y = 6, w = 73, h = 50;
    questWindow(x, y, w, h, 'COMMAND');
    QUEST_COMMANDS.forEach((c, k) => {
      const cx = x + 9 + (k % 2) * 33, cy = y + 7 + (k >> 1) * 10;
      if (k === this.i && (frameN >> 4) % 4 !== 3) text('>', cx - 7, cy, 3);
      text(c.slice(0, 5), cx, cy, 3);
    });
  }
}

function questSearch(field) {
  const day = Math.floor(Date.now() / 86400000), key = `${G.map}:${G.x},${G.y}`;
  G.questSearched = G.questSearched || {};
  if (G.questSearched[key] === day) return say(`${G.name} searched the ground here already today.`);
  G.questSearched[key] = day;
  const roll = hashStr(`${key}|${day}|${G.name}`) % 10;
  if (roll === 0 && G.inv) { G.inv.potion = (G.inv.potion || 0) + 1; SFX.select(); return say([`${G.name} searched the ground...`, 'and found a healing draught!']); }
  if (roll <= 2) { const g = 2 + (G.lvl || 1) * (1 + roll); G.gold += g; SFX.select(); return say([`${G.name} searched the ground...`, `and found ${g} gold!`]); }
  say([`${G.name} searched the ground...`, 'Nothing is here.']);
}

function questCommand(cmd, field) {
  if (cmd === 'TALK') { const n = scenes.length; field.questTalking = true; field.interact(); field.questTalking = false; if (scenes.length === n) say('There is no one there.'); return; }
  if (cmd === 'STATUS') return push(new CharacterMenu());
  if (cmd === 'ITEM') return push(new InventoryScene('field'));
  if (cmd === 'SPELL') return push(new Spellbook());
  if (cmd === 'EQUIP') return push(new PaperDoll());
  if (cmd === 'MAP') return push(new WorldMap());
  if (cmd === 'SEARCH') return questSearch(field);
  if (cmd === 'STAIRS') {
    const ch = field.chAt(G.x, G.y);
    if (G.inst && ch === 'L') return leaveInstance();
    if (G.inst && ch === 'U') return towerNext();
    return say('There are no stairs here.');
  }
}

if (typeof window !== 'undefined' && typeof Field !== 'undefined') {
  // A on nothing opens the COMMAND window
  const interact0 = Field.prototype.interact;
  Field.prototype.interact = function () {
    const n = scenes.length, t = toasts.length;
    const r = interact0.apply(this, arguments);
    if (questUi() && !this.questTalking && scenes.length === n && toasts.length === t && scenes[scenes.length - 1] === this) push(new QuestCommand(this));
    return r;
  };
  // the status window appears once you have stood still for about two thirds of a second
  const draw0 = Field.prototype.draw;
  Field.prototype.draw = function () {
    draw0.apply(this, arguments);
    if (!questUi() || !G) return;
    const moving = this.ox || this.oy;
    this.questIdle = moving ? 0 : (this.questIdle || 0) + 1;
    if (this.questIdle > 40 && scenes[scenes.length - 1] === this) questStatusWindow(this);
  };
  window.GBQQuestUi = { QUEST_COMMANDS, questCommand, QuestCommand };
}
if (typeof globalThis !== 'undefined') globalThis.GBQQuestUiData = { QUEST_COMMANDS, QUEST_SHADES };
