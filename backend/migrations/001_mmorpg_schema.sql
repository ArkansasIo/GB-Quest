CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY,
  username varchar(16) NOT NULL,
  password_salt bytea NOT NULL,
  password_hash bytea NOT NULL,
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_username_lower_uq ON accounts (lower(username));

CREATE TABLE IF NOT EXISTS characters (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name varchar(16) NOT NULL,
  class varchar(16) NOT NULL CHECK (class IN ('warrior','mage','ranger','cleric','rogue','adventurer')),
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
  xp bigint NOT NULL DEFAULT 0 CHECK (xp >= 0),
  zone_id varchar(48) NOT NULL DEFAULT 'aelmoor_fields',
  x integer NOT NULL DEFAULT 8 CHECK (x BETWEEN 0 AND 255),
  y integer NOT NULL DEFAULT 8 CHECK (y BETWEEN 0 AND 255),
  hp integer NOT NULL DEFAULT 100 CHECK (hp >= 0),
  max_hp integer NOT NULL DEFAULT 100 CHECK (max_hp > 0),
  mp integer NOT NULL DEFAULT 40 CHECK (mp >= 0),
  max_mp integer NOT NULL DEFAULT 40 CHECK (max_mp >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS characters_account_created_idx ON characters(account_id, created_at);

CREATE TABLE IF NOT EXISTS world_mobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id varchar(48) NOT NULL,
  name varchar(40) NOT NULL,
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
  x integer NOT NULL CHECK (x BETWEEN 0 AND 255),
  y integer NOT NULL CHECK (y BETWEEN 0 AND 255),
  hp integer NOT NULL CHECK (hp >= 0),
  max_hp integer NOT NULL CHECK (max_hp > 0),
  alive boolean NOT NULL DEFAULT true,
  respawn_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS world_mobs_zone_alive_idx ON world_mobs(zone_id, alive);

CREATE TABLE IF NOT EXISTS world_events (
  id bigserial PRIMARY KEY,
  zone_id varchar(48) NOT NULL,
  event_type varchar(40) NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS world_events_zone_created_idx ON world_events(zone_id, created_at DESC);

INSERT INTO world_mobs(id,zone_id,name,level,x,y,hp,max_hp,alive)
VALUES
 ('00000000-0000-4000-8000-000000000001','aelmoor_fields','Training Slime',1,11,8,24,24,true),
 ('00000000-0000-4000-8000-000000000002','aelmoor_fields','Wild Goblin',2,14,9,48,48,true),
 ('00000000-0000-4000-8000-000000000003','aelmoor_fields','Forest Wolf',3,18,12,72,72,true)
ON CONFLICT (id) DO NOTHING;

-- Persistent item catalogue, per-character inventory and equipment.
CREATE TABLE IF NOT EXISTS item_catalog (
  id varchar(48) PRIMARY KEY,
  name varchar(64) NOT NULL,
  description varchar(240) NOT NULL DEFAULT '',
  item_type varchar(20) NOT NULL CHECK (item_type IN ('weapon','armor','consumable','material','accessory')),
  equip_slot varchar(20) CHECK (equip_slot IN ('main_hand','off_hand','head','chest','legs','feet','hands','accessory')),
  max_stack integer NOT NULL DEFAULT 99 CHECK (max_stack BETWEEN 1 AND 999),
  level_required integer NOT NULL DEFAULT 1 CHECK (level_required BETWEEN 1 AND 100),
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS character_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id varchar(48) NOT NULL REFERENCES item_catalog(id),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 999),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(character_id, item_id)
);
CREATE INDEX IF NOT EXISTS character_inventory_character_idx ON character_inventory(character_id);
CREATE TABLE IF NOT EXISTS character_equipment (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  slot varchar(20) NOT NULL CHECK (slot IN ('main_hand','off_hand','head','chest','legs','feet','hands','accessory')),
  inventory_id uuid NOT NULL REFERENCES character_inventory(id) ON DELETE CASCADE,
  equipped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(character_id, slot),
  UNIQUE(inventory_id)
);
INSERT INTO item_catalog(id,name,description,item_type,equip_slot,max_stack,level_required,stats) VALUES
 ('rusty_sword','Rusty Sword','A dependable starter blade.','weapon','main_hand',1,1,'{"attack":3}'::jsonb),
 ('traveler_tunic','Traveler Tunic','Simple padded travel clothing.','armor','chest',1,1,'{"defense":2}'::jsonb),
 ('minor_potion','Minor Potion','A small restorative potion.','consumable',NULL,20,1,'{"heal":30}'::jsonb)
ON CONFLICT (id) DO NOTHING;


-- Server-owned currency, repeatable quest definitions and per-character quest state.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS gold bigint NOT NULL DEFAULT 0 CHECK (gold >= 0);
CREATE TABLE IF NOT EXISTS quest_catalog (
  id varchar(48) PRIMARY KEY,
  name varchar(80) NOT NULL,
  description varchar(300) NOT NULL DEFAULT '',
  objective_type varchar(24) NOT NULL CHECK (objective_type IN ('kill_mob')),
  objective_target_id uuid NOT NULL REFERENCES world_mobs(id),
  objective_required integer NOT NULL DEFAULT 1 CHECK (objective_required BETWEEN 1 AND 1000),
  reward_xp integer NOT NULL DEFAULT 0 CHECK (reward_xp >= 0),
  reward_gold integer NOT NULL DEFAULT 0 CHECK (reward_gold >= 0),
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS character_quests (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  quest_id varchar(48) NOT NULL REFERENCES quest_catalog(id),
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  objective_progress integer NOT NULL DEFAULT 0 CHECK (objective_progress >= 0),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY(character_id, quest_id)
);
CREATE INDEX IF NOT EXISTS character_quests_status_idx ON character_quests(character_id,status);
INSERT INTO item_catalog(id,name,description,item_type,max_stack,level_required,stats)
VALUES ('slime_gel','Slime Gel','A sticky alchemical crafting material.','material',99,1,'{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
INSERT INTO quest_catalog(id,name,description,objective_type,objective_target_id,objective_required,reward_xp,reward_gold)
VALUES ('first_slime','A Slime in the Fields','Defeat the Training Slime near the Aelmoor road.','kill_mob','00000000-0000-4000-8000-000000000001',1,35,25)
ON CONFLICT (id) DO NOTHING;
