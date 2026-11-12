-- Regions and realms (WoW-style): a region (data centre) holds realms; every character lives on one realm,
-- and each realm is its own copy of the world (its own monsters, players, zone and realm chat).
-- Safe to run again: every statement is idempotent.

CREATE TABLE IF NOT EXISTS regions (
  id varchar(24) PRIMARY KEY,
  name varchar(32) NOT NULL,
  tag varchar(8) NOT NULL,
  timezone varchar(40) NOT NULL DEFAULT 'UTC',
  status varchar(16) NOT NULL DEFAULT 'online' CHECK (status IN ('online','maintenance','offline')),
  sort_order integer NOT NULL DEFAULT 0
);
INSERT INTO regions(id,name,tag,timezone,sort_order) VALUES
 ('hydaelyn','Hydaelyn','NA','America/Los_Angeles',1),
 ('lordeon','Lordeon','EU','Europe/Paris',2),
 ('aether','Aether','AP','Asia/Tokyo',3)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS realms (
  id varchar(24) PRIMARY KEY,
  region_id varchar(24) NOT NULL REFERENCES regions(id),
  name varchar(32) NOT NULL UNIQUE,
  realm_type varchar(16) NOT NULL CHECK (realm_type IN ('PvE','PvP','Roleplay','Seasonal')),
  max_players integer NOT NULL DEFAULT 1000 CHECK (max_players > 0),
  status varchar(16) NOT NULL DEFAULT 'online' CHECK (status IN ('online','maintenance','offline','locked')),
  recommended boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO realms(id,region_id,name,realm_type,recommended,sort_order) VALUES
 ('ardenhold','hydaelyn','Ardenhold','Roleplay',false,1),
 ('ironreach','hydaelyn','Ironreach','PvE',true,2),
 ('starhaven','hydaelyn','Starhaven','Seasonal',false,3),
 ('moonfall','lordeon','Moonfall','PvE',true,1),
 ('stormwake','lordeon','Stormwake','PvP',false,2),
 ('frostmarch','lordeon','Frostmarch','PvP',false,3),
 ('dawnspire','aether','Dawnspire','Roleplay',false,1),
 ('emberwild','aether','Emberwild','PvE',true,2),
 ('shadowfen','aether','Shadowfen','Roleplay',false,3)
ON CONFLICT (id) DO NOTHING;

-- characters live on a realm; names are unique per realm (any letter case)
ALTER TABLE characters ADD COLUMN IF NOT EXISTS realm_id varchar(24) NOT NULL DEFAULT 'ardenhold' REFERENCES realms(id);
CREATE INDEX IF NOT EXISTS characters_account_realm_idx ON characters(account_id, realm_id, created_at);
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS characters_realm_name_uq ON characters(realm_id, lower(name));
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'characters_realm_name_uq not created: rename duplicate character names on a realm, then migrate again';
END $$;

-- every realm has its own monsters: spawn_id names the template a copy came from
ALTER TABLE world_mobs ADD COLUMN IF NOT EXISTS realm_id varchar(24) NOT NULL DEFAULT 'ardenhold' REFERENCES realms(id);
ALTER TABLE world_mobs ADD COLUMN IF NOT EXISTS spawn_id uuid;
UPDATE world_mobs SET spawn_id=id WHERE spawn_id IS NULL;
INSERT INTO world_mobs(id,realm_id,spawn_id,zone_id,name,level,x,y,hp,max_hp,alive)
SELECT md5(r.id || ':' || m.id::text)::uuid, r.id, m.id, m.zone_id, m.name, m.level, m.x, m.y, m.max_hp, m.max_hp, true
FROM world_mobs m CROSS JOIN realms r
WHERE m.realm_id='ardenhold' AND m.spawn_id=m.id AND r.id<>'ardenhold'
ON CONFLICT (id) DO NOTHING;
CREATE INDEX IF NOT EXISTS world_mobs_realm_zone_alive_idx ON world_mobs(realm_id, zone_id, alive);

ALTER TABLE world_events ADD COLUMN IF NOT EXISTS realm_id varchar(24);
