-- Class specializations and a complete three-branch talent catalogue through level 720.
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_level_check;
ALTER TABLE characters ADD CONSTRAINT characters_level_check CHECK (level BETWEEN 1 AND 720);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS specialization_id varchar(48);

CREATE TABLE IF NOT EXISTS mmorpg_talent_specializations (
  id varchar(48) PRIMARY KEY,
  class_id varchar(16) NOT NULL CHECK (class_id IN ('warrior','mage','ranger','cleric','rogue','adventurer')),
  name varchar(64) NOT NULL,
  role varchar(32) NOT NULL,
  description varchar(240) NOT NULL DEFAULT '',
  UNIQUE(class_id,name)
);
CREATE TABLE IF NOT EXISTS mmorpg_talent_nodes (
  id varchar(80) PRIMARY KEY,
  specialization_id varchar(48) NOT NULL REFERENCES mmorpg_talent_specializations(id) ON DELETE CASCADE,
  node_index integer NOT NULL CHECK (node_index BETWEEN 0 AND 72),
  branch varchar(16) NOT NULL CHECK (branch IN ('assault','utility','mastery')),
  node_type varchar(16) NOT NULL CHECK (node_type IN ('active','passive','ultimate')),
  name varchar(100) NOT NULL,
  description varchar(240) NOT NULL DEFAULT '',
  required_level integer NOT NULL CHECK (required_level BETWEEN 1 AND 720),
  point_cost integer NOT NULL DEFAULT 1 CHECK (point_cost BETWEEN 1 AND 5),
  effect jsonb NOT NULL DEFAULT '{}'::jsonb,
  prerequisite_id varchar(80) REFERENCES mmorpg_talent_nodes(id),
  UNIQUE(specialization_id,node_index)
);
CREATE INDEX IF NOT EXISTS mmorpg_talent_nodes_tree_idx
  ON mmorpg_talent_nodes(specialization_id,required_level,branch);
CREATE TABLE IF NOT EXISTS character_talent_unlocks (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  node_id varchar(80) NOT NULL REFERENCES mmorpg_talent_nodes(id),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(character_id,node_id)
);
CREATE INDEX IF NOT EXISTS character_talent_unlocks_character_idx
  ON character_talent_unlocks(character_id,unlocked_at);

INSERT INTO mmorpg_talent_specializations(id,class_id,name,role,description) VALUES
 ('warrior_vanguard','warrior','Vanguard','Tank','Shield control, threat generation and frontline protection'),
 ('warrior_berserker','warrior','Berserker','Damage','Rage, heavy strikes and relentless pressure'),
 ('warrior_sentinel','warrior','Sentinel','Hybrid','Weapon mastery, counters and defensive formations'),
 ('mage_arcanist','mage','Arcanist','Damage','Arcane bolts, mana efficiency and spell amplification'),
 ('mage_pyromancer','mage','Pyromancer','Damage','Burning damage, explosions and fire zones'),
 ('mage_chronomancer','mage','Chronomancer','Support','Time control, cooldown manipulation and temporal barriers'),
 ('ranger_hunter','ranger','Hunter','Damage','Tracking, traps and sustained ranged attacks'),
 ('ranger_marksman','ranger','Marksman','Damage','Precision shots, critical hits and long-range control'),
 ('ranger_beastwarden','ranger','Beastwarden','Support','Companion commands, bonds and coordinated attacks'),
 ('cleric_oracle','cleric','Oracle','Healer','Restoration, foresight and group sustain'),
 ('cleric_templar','cleric','Templar','Hybrid','Holy damage, armor and frontline support'),
 ('cleric_warden','cleric','Warden','Support','Sanctuary, cleansing and protective wards'),
 ('rogue_assassin','rogue','Assassin','Damage','Execution, poison and single-target burst'),
 ('rogue_shadowdancer','rogue','Shadowdancer','Damage','Stealth, mobility and shadow attacks'),
 ('rogue_trickster','rogue','Trickster','Control','Deception, gadgets and enemy disruption'),
 ('adventurer_spellblade','adventurer','Spellblade','Hybrid','Balanced weapon techniques and elemental magic'),
 ('adventurer_explorer','adventurer','Explorer','Utility','Survival, discovery and adaptable fieldcraft'),
 ('adventurer_tactician','adventurer','Tactician','Support','Party coordination, tactical buffs and control')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role,description=EXCLUDED.description;

WITH node_rows AS (
  SELECT s.id AS spec_id, n AS idx,
    CASE n % 3 WHEN 0 THEN 'assault' WHEN 1 THEN 'utility' ELSE 'mastery' END AS branch,
    CASE WHEN n=72 THEN 'ultimate' WHEN n % 4=0 THEN 'active' ELSE 'passive' END AS node_type,
    CASE WHEN n=72 THEN 720 ELSE n*10+1 END AS required_level,
    CASE WHEN n=72 THEN 3 WHEN n % 12=0 THEN 2 ELSE 1 END AS point_cost
  FROM mmorpg_talent_specializations s CROSS JOIN generate_series(0,72) AS gs(n)
)
INSERT INTO mmorpg_talent_nodes(id,specialization_id,node_index,branch,node_type,name,description,required_level,point_cost,effect,prerequisite_id)
SELECT spec_id || '_node_' || lpad(idx::text,2,'0'), spec_id, idx, branch, node_type,
  CASE WHEN idx=72 THEN 'Grandmaster Capstone'
       ELSE initcap(branch) || ' Talent ' || lpad((idx/3+1)::text,2,'0') END,
  CASE WHEN node_type='active' THEN 'Unlocks a class-specific combat action in this specialization.'
       WHEN node_type='ultimate' THEN 'Unlocks the specialization defining ultimate ability.'
       ELSE 'Improves a specialization passive and its combat utility.' END,
  required_level,point_cost,
  jsonb_build_object('kind',node_type,'branch',branch,'rank',idx/3+1,
    'power',CASE WHEN node_type='ultimate' THEN 100 ELSE 3+(idx/3) END),
  CASE WHEN idx>=3 THEN spec_id || '_node_' || lpad((idx-3)::text,2,'0') ELSE NULL END
FROM node_rows
ON CONFLICT (id) DO UPDATE SET
  required_level=EXCLUDED.required_level,point_cost=EXCLUDED.point_cost,
  effect=EXCLUDED.effect,prerequisite_id=EXCLUDED.prerequisite_id;
