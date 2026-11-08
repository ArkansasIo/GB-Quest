import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/awakening.js', import.meta.url), 'utf8');
function load() { const context = { Math, Number, String, Object, Array, Set, globalThis: null }; context.globalThis = context; vm.runInNewContext(source, context); return context.GBQAwakening; }
const plain = v => JSON.parse(JSON.stringify(v));
const CLASS_ORDER = ['warden', 'berserker', 'vanguard', 'strider', 'shade', 'ascetic', 'arcanist', 'wildblood', 'pactbound', 'cantor', 'chaplain', 'verdant', 'necromancer', 'summoner', 'sunwarden', 'runeblade',
  'ronin', 'shinobi', 'bladedancer', 'wyrmlancer', 'corsair', 'beastcaller', 'puppeteer', 'dreadknight', 'voidhunter', 'scalesage', 'stormcaller'];
const STATS = ['crit', 'critdmg', 'dodge', 'block', 'leech', 'haste', 'dmg', 'heal', 'resist', 'thorns', 'hp', 'hpPct', 'acb', 'hit', 'fire', 'cold', 'lightning', 'necrotic', 'radiant', 'mf', 'gf'];
const BUFFS = ['bless', 'haste', 'regen', 'fortify', 'might', 'inspired', 'trueveil', 'foresight', 'frenzy', 'focus', 'thornskin', 'vulnerable', 'doomed', 'weakened', 'frostbite', 'bleeding', 'sundered', 'shocked'];

test('every class has an awakened form with known stats, buffs and a valid ultimate', () => {
  const A = load();
  assert.deepEqual(Object.keys(A.AWAKEN_CLASSES).sort(), CLASS_ORDER.slice().sort());
  const names = new Set();
  for (const [id, d] of Object.entries(A.AWAKEN_CLASSES)) {
    assert.ok(!names.has(d.name), `unique name ${d.name}`); names.add(d.name);
    for (const k of Object.keys(d.per)) assert.ok(STATS.includes(k), `${id} stat ${k}`);
    assert.ok(BUFFS.includes(d.start), `${id} start buff`);
    assert.ok(['strike', 'nova', 'bolt', 'mend', 'guard', 'summon'].includes(d.ult.kind), `${id} ult kind`);
    for (const b of [d.ult.mark, d.ult.self, d.ult.buff, ...(d.ult.buffs || [])].filter(Boolean)) assert.ok(BUFFS.includes(b), `${id} ult buff ${b}`);
    assert.ok(d.ult.name.length <= 15, `${id} ult name fits the battle menu`);
    assert.ok(A.ultDesc(id, A.normAwaken({ tier: 1 }), 100).startsWith(d.ult.name));
  }
});

test('class tiers unlock by level and gold', () => {
  const A = load(), a = A.normAwaken(null);
  assert.deepEqual(plain(a), { tier: 0, ranks: { talent: 0, spell: 0, ability: 0 }, god: { war: 0, arcana: 0, life: 0, shadow: 0 } });
  assert.equal(A.tierBlock(a, 59, 1e9), 'Reach level 60.');
  assert.equal(A.tierBlock(a, 60, 100), 'Needs 2000 G.');
  assert.equal(A.tierBlock(a, 60, 2000), null);
  assert.equal(A.tierBlock(A.normAwaken({ tier: 5 }), 720, 1e9), 'Fully awakened.');
  assert.deepEqual([1, 60, 150, 269, 270, 600, 720].map(A.tierCapForLevel), [0, 1, 2, 2, 3, 5, 5]);
});

test('awakening points, rank costs and track caps', () => {
  const A = load();
  assert.equal(A.apTotal(0, 720), 0);
  assert.equal(A.apTotal(1, 60), 2);
  assert.equal(A.apTotal(5, 720), 43);
  assert.equal(A.trackSpent(10), 19);
  const a = A.normAwaken({ tier: 1, ranks: { talent: 9 } });
  assert.equal(a.ranks.talent, 2, 'tier I caps tracks at rank 2');
  assert.equal(A.raiseBlock(a, 60, 'talent'), 'Class tier I caps tracks at rank 2.');
  assert.equal(A.raiseBlock(A.normAwaken({ tier: 1 }), 60, 'spell'), null);
  assert.equal(A.raiseBlock(A.normAwaken({ tier: 1, ranks: { spell: 2 } }), 60, 'ability'), 'Needs 1 AP.');
  assert.equal(A.raiseBlock(A.normAwaken({ tier: 0 }), 720, 'spell'), 'Awaken your class first.');
});

test('stat bonuses stack class tiers, talent, spell and ability ranks', () => {
  const A = load();
  const a = A.normAwaken({ tier: 3, ranks: { talent: 5, spell: 4, ability: 6 } });
  const s = A.awakenSub(a, 'warden', { hp: 10, acb: 2 });
  assert.equal(s.acb, 3 + 1, 'tier x1 armour + talent 2*0.5');
  assert.equal(s.block, 9); assert.equal(s.hpPct, 9); assert.equal(s.hp, 5);
  assert.equal(s.fire, 12); assert.equal(s.heal, 12);
  assert.equal(s.crit, 9); assert.equal(s.critdmg, 30);
  assert.equal(A.spellDcBonus(a), 1); assert.equal(A.spellSlotBonus(a), 0);
  assert.equal(A.resourceBonus(a), 2); assert.equal(A.skillUsesPerBattle(a), 2);
  assert.equal(A.startBuffRounds(a), 2);
  assert.deepEqual(plain(A.awakenSub(A.normAwaken({}), 'warden', { hp: 10 })), {});
});

test('ultimates grow with power and level', () => {
  const A = load();
  assert.equal(A.ultNumbers('strike', 1, 0).dice, '5d10');
  assert.equal(A.ultNumbers('strike', 15, 720).dice, '41d10');
  assert.equal(A.ultNumbers('nova', 10, 0).dice, '7d10');
  assert.equal(A.ultNumbers('mend', 30, 0, 30).pct, 80, 'healing is capped');
  assert.equal(A.ultNumbers('summon', 10, 0, 2).count, 4);
});

test('god talents: tier III gate, divinity points, one capstone', () => {
  const A = load();
  assert.equal(Object.keys(A.GOD_PANTHEONS).length, 4);
  for (const p of Object.values(A.GOD_PANTHEONS)) {
    assert.equal(p.ranks.length, 5);
    for (const r of p.ranks) for (const k of Object.keys(r.mods)) assert.ok(STATS.includes(k), k);
    assert.ok(BUFFS.includes(p.ranks[4].start) && p.ranks[4].capstone);
  }
  assert.equal(A.dpTotal(2, 720), 0);
  assert.equal(A.dpTotal(3, 270), 0);
  assert.equal(A.dpTotal(5, 720), 20);
  assert.equal(A.godBlock(A.normAwaken({ tier: 2 }), 400, 'war'), 'Reach class tier III.');
  const a = A.normAwaken({ tier: 5, god: { war: 5, arcana: 4 } });
  assert.equal(A.godCapstone(a), 'war');
  assert.equal(A.godBlock(a, 720, 'arcana'), 'You already serve KARRATH THE UNBOWED.');
  assert.equal(A.godBlock(a, 720, 'life'), null);
  assert.equal(A.normAwaken({ tier: 5, god: { war: 5, arcana: 5 } }).god.arcana, 4, 'a second capstone is stripped');
  assert.equal(A.normAwaken({ tier: 2, god: { war: 3 } }).god.war, 0, 'below tier III god talents do nothing');
  assert.deepEqual(plain(A.godSub(A.normAwaken({ tier: 3, god: { war: 2 } }))), { dmg: 8, hit: 2, crit: 3 });
  const arc = A.normAwaken({ tier: 5, ranks: { ability: 4 }, god: { arcana: 5 } });
  assert.equal(A.ultPower(arc), 5 + 4 + 3, 'arcana capstone adds ultimate power');
  assert.ok(A.awakenSub(arc, 'arcanist', {}).necrotic >= 20);
});
