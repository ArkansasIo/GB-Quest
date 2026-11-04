import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const c = { Math, Number, String, Object, Array, JSON, globalThis: null }; c.globalThis = c;
vm.runInNewContext(fs.readFileSync(new URL('../src/chatframe.js', import.meta.url), 'utf8'), c);
const C = c.GBQChat, plain = v => JSON.parse(JSON.stringify(v));

test('defaults: chat on, all channels on, six WoW-style tabs', () => {
  const cfg = C.normalizeChatConfig(null);
  assert.equal(cfg.master, true); assert.equal(cfg.npc, true); assert.ok(Object.values(cfg.muted).every(v => v === false));
  assert.deepEqual(plain(cfg.tabs.map(t => t.name)), ['GENERAL', 'COMBAT LOG', 'LOOT', 'WHISPERS', 'WORLD', 'GUILD']);
  assert.ok(!cfg.tabs[0].ch.includes('combat')); assert.equal(cfg.active, 'general');
});

test('turning world chat off drops General messages; other channels still pass', () => {
  const off = C.setChannel(null, 'general', false).cfg;
  assert.equal(C.chatAllowed(off, { channel: 'world' }), false);
  assert.equal(C.chatAllowed(off, { channel: 'trade' }), true);
  assert.equal(C.chatAllowed(off, { channel: 'say' }), true);
  assert.equal(C.setChannel(off, '1', true).cfg.muted.world, false, '/chaton 1');
  const npc = C.setChannel(null, 'npc', false).cfg;
  assert.equal(C.chatAllowed(npc, { channel: 'say', sim: true }), false); assert.equal(C.chatAllowed(npc, { channel: 'say' }), true);
  const all = C.setChannel(null, 'all', false).cfg;
  assert.deepEqual(plain(all.muted), { world: true, trade: true, defense: true, lfg: true, custom: true }); assert.equal(all.npc, false);
  assert.equal(C.setChannel(null, 'banana', false).ok, false);
});

test('typed messages map to their public channel', () => {
  assert.deepEqual(['/1 hi', '/general hi', '/2 wts', '/3 help', '/4 lfg', '/6 yo', '/p hi', 'hello', '/w bob hi'].map(C.sendTarget), ['world', 'world', 'trade', 'defense', 'lfg', 'custom', null, null, null]);
});

test('tabs: add (max 8), rename, toggle channels, delete; GENERAL stays', () => {
  let cfg = C.normalizeChatConfig(null);
  const a = C.addTab(cfg, 'raid team!', ['raid', 'party']); assert.equal(a.ok, true); assert.equal(a.tab.name, 'RAID TEAM'); assert.equal(a.cfg.active, a.tab.id);
  cfg = a.cfg; assert.equal(C.tabShows(a.tab, { channel: 'raid' }), true); assert.equal(C.tabShows(a.tab, { channel: 'say' }), false);
  cfg = C.toggleTabChannel(cfg, a.tab.id, 'say').cfg; assert.ok(cfg.tabs.find(t => t.id === a.tab.id).ch.includes('say'));
  cfg = C.renameTab(cfg, a.tab.id, 'Raid').cfg; assert.equal(cfg.tabs.find(t => t.id === a.tab.id).name, 'RAID');
  assert.equal(C.renameTab(cfg, a.tab.id, '!!!').ok, false);
  assert.equal(C.addTab(C.addTab(cfg).cfg).ok, false, 'eight tabs at most');
  assert.equal(C.removeTab(cfg, 'general').ok, false);
  const r = C.removeTab(cfg, a.tab.id); assert.equal(r.ok, true); assert.equal(r.cfg.active, 'general'); assert.equal(r.cfg.tabs.length, 6);
});

test('stored settings are sanitised', () => {
  const cfg = C.normalizeChatConfig({ master: false, npc: false, muted: { world: true, bogus: true }, tabs: [{ id: 'x', name: 'mine', ch: ['say', 'nope'] }, { id: 'x', name: 'dupe', ch: [] }, { id: 'BAD ID', name: 'z', ch: [] }], active: 'zzz' });
  assert.equal(cfg.master, false); assert.equal(cfg.npc, false); assert.equal(cfg.muted.world, true); assert.ok(!('bogus' in cfg.muted));
  assert.deepEqual(plain(cfg.tabs.map(t => [t.id, t.name, t.ch])), plain([['general', 'GENERAL', C.DEFAULT_TABS[0].ch], ['x', 'MINE', ['say']]]));
  assert.equal(cfg.active, 'general');
});
