-- Talent trees for the browser game's 27 jobs.
-- Migration 009 moved every character onto the 27 jobs, but migration 012 seeded specializations only for the six
-- legacy classes, so no job character could choose a specialization or learn talents. This adds two
-- specializations per job, named after the job's subclasses in src/jobs_data.js / src/data_rules.js (CLASSES[job].subs),
-- each with the same 73-node, three-branch tree to level 720 as the legacy classes, including the combat tuning of
-- migration 013 and the cooldowns of migration 014. Legacy-class trees are kept for any remaining legacy characters.

ALTER TABLE mmorpg_talent_specializations DROP CONSTRAINT IF EXISTS mmorpg_talent_specializations_class_id_check;
ALTER TABLE mmorpg_talent_specializations ADD CONSTRAINT mmorpg_talent_specializations_class_id_check CHECK (class_id IN (
  'warden','berserker','vanguard','strider','shade','ascetic','arcanist','wildblood','pactbound',
  'cantor','chaplain','verdant','necromancer','summoner','sunwarden','runeblade','ronin','shinobi',
  'bladedancer','wyrmlancer','corsair','beastcaller','puppeteer','dreadknight','voidhunter','scalesage','stormcaller',
  'warrior','mage','ranger','cleric','rogue','adventurer'
));

INSERT INTO mmorpg_talent_specializations(id,class_id,name,role,description) VALUES
 ('warden_champion','warden','Champion','Tank','Warden specialization. Crit on 19-20.'),
 ('warden_tactician','warden','Tactician','Tank','Warden specialization. +1d8 on first hit each turn (4/rest).'),
 ('berserker_frenzy','berserker','Frenzy','Tank','Berserker specialization. Extra attack while raging.'),
 ('berserker_totem','berserker','Totem','Tank','Berserker specialization. Resist all damage while raging.'),
 ('vanguard_devotion','vanguard','Devotion','Tank','Vanguard specialization. +CHA to hit (channel, 1/rest).'),
 ('vanguard_vengeance','vanguard','Vengeance','Tank','Vanguard specialization. Advantage vs your sworn foe.'),
 ('strider_hunter','strider','Hunter','Damage','Strider specialization. +1d8 vs wounded foes.'),
 ('strider_beastmaster','strider','Beastmaster','Damage','Strider specialization. A wolf fights beside you.'),
 ('shade_thief','shade','Thief','Damage','Shade specialization. Use items as a bonus action.'),
 ('shade_assassin','shade','Assassin','Damage','Shade specialization. Auto-crit foes that have not acted.'),
 ('ascetic_openhand','ascetic','Open Hand','Damage','Ascetic specialization. Flurry knocks foes prone.'),
 ('ascetic_shadow','ascetic','Shadow','Damage','Ascetic specialization. Begin fights unseen.'),
 ('arcanist_evoker','arcanist','Evoker','Damage','Arcanist specialization. +INT to STORM spell damage.'),
 ('arcanist_abjurer','arcanist','Abjurer','Damage','Arcanist specialization. Arcane ward of temp HP each fight.'),
 ('wildblood_draconic','wildblood','Draconic','Damage','Wildblood specialization. AC 13+DEX, +CHA fire damage.'),
 ('wildblood_surge','wildblood','Wild Surge','Damage','Wildblood specialization. Spells may surge with bonus effects.'),
 ('pactbound_fiend','pactbound','Fiend Pact','Damage','Pactbound specialization. Temp HP when you kill.'),
 ('pactbound_archfey','pactbound','Archfey','Damage','Pactbound specialization. Charm all foes (1/rest).'),
 ('cantor_lore','cantor','Lore','Healer','Cantor specialization. Cutting words blunt enemy hits.'),
 ('cantor_valor','cantor','Valor','Healer','Cantor specialization. Extra attack at level 6.'),
 ('chaplain_life','chaplain','Life','Healer','Chaplain specialization. Heals restore +2+slot level.'),
 ('chaplain_tempest','chaplain','Tempest','Healer','Chaplain specialization. Max lightning/thunder damage (channel).'),
 ('verdant_moon','verdant','Moon','Healer','Verdant specialization. Stronger beast shapes.'),
 ('verdant_land','verdant','Land','Healer','Verdant specialization. Recover slots on short rest.'),
 ('necromancer_gravecaller','necromancer','Gravecaller','Damage','Necromancer specialization. Claim vitality when you defeat an enemy.'),
 ('necromancer_boneweaver','necromancer','Boneweaver','Damage','Necromancer specialization. Gain a protective arcane ward each fight.'),
 ('summoner_spiritcaller','summoner','Spiritcaller','Damage','Summoner specialization. Call a spirit companion to fight at your side.'),
 ('summoner_wardbinder','summoner','Wardbinder','Damage','Summoner specialization. Protect yourself with a ward at the start of battle.'),
 ('sunwarden_dawnkeeper','sunwarden','Dawnkeeper','Healer','Sunwarden specialization. Restore more health with healing spells.'),
 ('sunwarden_sunstriker','sunwarden','Sunstriker','Healer','Sunwarden specialization. Invoke sacred power to empower your weapon.'),
 ('runeblade_bloodrune','runeblade','Blood Rune','Tank','Runeblade specialization. Withstand damage through dark runic power.'),
 ('runeblade_frostbrand','runeblade','Frost Brand','Tank','Runeblade specialization. Unleash a practiced runic strike.'),
 ('ronin_kensai','ronin','Kensai','Damage','Ronin specialization. Crit on 19-20.'),
 ('ronin_iaido','ronin','Iaido','Damage','Ronin specialization. +1d8 on first hit each turn (4/rest).'),
 ('shinobi_kage','shinobi','Kage','Damage','Shinobi specialization. Start every battle invisible.'),
 ('shinobi_yamikiri','shinobi','Yamikiri','Damage','Shinobi specialization. Strike hard before foes act.'),
 ('bladedancer_veil','bladedancer','Veil Dancer','Healer','Bladedancer specialization. Start battles with a ward.'),
 ('bladedancer_edge','bladedancer','Edge Dancer','Healer','Bladedancer specialization. Crit on 19-20.'),
 ('wyrmlancer_skyleap','wyrmlancer','Skyleap','Damage','Wyrmlancer specialization. Crit on 19-20.'),
 ('wyrmlancer_wyrmbond','wyrmlancer','Wyrmbond','Damage','Wyrmlancer specialization. A wyvern hatchling fights beside you.'),
 ('corsair_fortune','corsair','Fortune','Damage','Corsair specialization. Crit on 19-20.'),
 ('corsair_quickdraw','corsair','Quickdraw','Damage','Corsair specialization. +1d8 on first hit each turn (4/rest).'),
 ('beastcaller_packlord','beastcaller','Packlord','Tank','Beastcaller specialization. A wolf joins every battle.'),
 ('beastcaller_feral','beastcaller','Feral','Tank','Beastcaller specialization. Fight like a beast: an extra attack in a frenzy.'),
 ('puppeteer_valoredge','puppeteer','Valoredge','Tank','Puppeteer specialization. Start battles with a ward.'),
 ('puppeteer_sharpshot','puppeteer','Sharpshot Frame','Tank','Puppeteer specialization. Crit on 19-20.'),
 ('dreadknight_bloodoath','dreadknight','Blood Oath','Tank','Dreadknight specialization. Vow of enmity against one foe.'),
 ('dreadknight_frostgrave','dreadknight','Frostgrave','Tank','Dreadknight specialization. Resist all damage while raging.'),
 ('voidhunter_havoc','voidhunter','Havoc','Damage','Voidhunter specialization. An extra attack in a frenzy.'),
 ('voidhunter_vengeance','voidhunter','Vengeance','Damage','Voidhunter specialization. Resist all damage while raging.'),
 ('scalesage_devastation','scalesage','Devastation','Healer','Scalesage specialization. Spell damage adds your INT.'),
 ('scalesage_preservation','scalesage','Preservation','Healer','Scalesage specialization. Healing spells heal more.'),
 ('stormcaller_thunder','stormcaller','Thunder','Healer','Stormcaller specialization. Lightning and thunder hit harder.'),
 ('stormcaller_tides','stormcaller','Tides','Healer','Stormcaller specialization. Healing spells heal more.')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role,description=EXCLUDED.description;

WITH node_rows AS (
  SELECT s.id AS spec_id, s.name AS spec_name, n AS idx,
    CASE n % 3 WHEN 0 THEN 'assault' WHEN 1 THEN 'utility' ELSE 'mastery' END AS branch,
    CASE WHEN n=72 THEN 'ultimate' WHEN n % 4=0 THEN 'active' ELSE 'passive' END AS node_type,
    CASE WHEN n=72 THEN 720 ELSE n*10+1 END AS required_level,
    CASE WHEN n=72 THEN 3 WHEN n > 0 AND n % 12=0 THEN 2 ELSE 1 END AS point_cost
  FROM mmorpg_talent_specializations s CROSS JOIN generate_series(0,72) AS gs(n)
  WHERE s.class_id NOT IN ('warrior','mage','ranger','cleric','rogue','adventurer')
)
INSERT INTO mmorpg_talent_nodes(id,specialization_id,node_index,branch,node_type,name,description,required_level,point_cost,effect,prerequisite_id)
SELECT spec_id || '_node_' || lpad(idx::text,2,'0'), spec_id, idx, branch, node_type,
  CASE WHEN idx=72 THEN 'Grandmaster Capstone'
       ELSE spec_name || ' ' || initcap(branch) || ' ' || lpad((idx/3+1)::text,2,'0') END,
  CASE WHEN node_type='active' THEN spec_name || ' ' || branch || ' active technique. Unlocks a server-validated combat action.'
       WHEN node_type='ultimate' THEN spec_name || ' ultimate capstone. Unlocks the defining ability of this specialization.'
       ELSE spec_name || ' ' || branch || ' passive. Improves this specialization and its combat utility.' END,
  required_level, point_cost,
  jsonb_build_object('kind',node_type,'branch',branch,'specialization',spec_name,'rank',idx/3+1,
    'power',CASE WHEN node_type='ultimate' THEN 100 ELSE 3+(idx/3) END,
    -- migration 013 combat tuning
    'damageBonus',CASE WHEN node_type='passive' THEN 1+(idx/12) ELSE 0 END,
    'damageMultiplier',CASE WHEN node_type='ultimate' THEN 3.0 WHEN node_type='active' THEN 1.25+LEAST(1.5,(idx/12)*0.1) ELSE 1.0 END,
    'manaCost',CASE WHEN node_type='ultimate' THEN 50 WHEN node_type='active' THEN 5+(idx/3) ELSE 0 END,
    -- migration 014 cooldowns
    'cooldownSeconds',CASE WHEN node_type='ultimate' THEN 90 WHEN node_type='active' THEN 8+(idx/3) ELSE 0 END),
  CASE WHEN idx>=3 THEN spec_id || '_node_' || lpad((idx-3)::text,2,'0') ELSE NULL END
FROM node_rows
ORDER BY spec_id, idx
ON CONFLICT (id) DO UPDATE SET
  node_type=EXCLUDED.node_type,name=EXCLUDED.name,description=EXCLUDED.description,
  required_level=EXCLUDED.required_level,point_cost=EXCLUDED.point_cost,
  effect=EXCLUDED.effect,prerequisite_id=EXCLUDED.prerequisite_id;
