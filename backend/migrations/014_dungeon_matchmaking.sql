-- Persistent role-based dungeon matchmaking queue and formed five-player instances.
CREATE TABLE IF NOT EXISTS dungeon_catalog (
  id varchar(64) PRIMARY KEY,
  name varchar(120) NOT NULL,
  min_level integer NOT NULL CHECK (min_level BETWEEN 1 AND 720),
  max_level integer NOT NULL CHECK (max_level BETWEEN min_level AND 720),
  party_size integer NOT NULL DEFAULT 5 CHECK (party_size = 5),
  enabled boolean NOT NULL DEFAULT true
);

INSERT INTO dungeon_catalog(id,name,min_level,max_level) VALUES
('map-instance-01','Forgotten Catacombs of Jadewind Basin',1,15),
('map-instance-02','Forgotten Catacombs of Dragonspine Range',6,20),
('map-instance-03','Forgotten Catacombs of Saffron Coast',11,25),
('map-instance-04','Forgotten Catacombs of Whispering Steppe',16,30),
('map-instance-05','Forgotten Catacombs of Lotus Delta',21,35),
('map-instance-06','Forgotten Catacombs of Obsidian Highlands',26,40),
('map-instance-07','Forgotten Catacombs of Moonlit Archipelago',31,45),
('map-instance-08','Forgotten Catacombs of Celestial Desert',36,50),
('map-instance-09','Forgotten Catacombs of Golden Dune Sea',21,35),
('map-instance-10','Forgotten Catacombs of Emerald Rift',26,40),
('map-instance-11','Forgotten Catacombs of Thunder Savannah',31,45),
('map-instance-12','Forgotten Catacombs of Redstone Escarpment',36,50),
('map-instance-13','Forgotten Catacombs of Crescent Oasis',41,55),
('map-instance-14','Forgotten Catacombs of Baobab Wilds',46,60),
('map-instance-15','Forgotten Catacombs of Ashen Caldera',51,65),
('map-instance-16','Forgotten Catacombs of Ivory Coast',56,70),
('map-instance-17','Forgotten Catacombs of Frostpine Frontier',41,55),
('map-instance-18','Forgotten Catacombs of Thunderbird Prairie',46,60),
('map-instance-19','Forgotten Catacombs of Red Canyonlands',51,65),
('map-instance-20','Forgotten Catacombs of Silverlake Country',56,70)
ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,min_level=EXCLUDED.min_level,max_level=EXCLUDED.max_level,enabled=true;

CREATE TABLE IF NOT EXISTS dungeon_match_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id varchar(24) NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  dungeon_id varchar(64) NOT NULL REFERENCES dungeon_catalog(id),
  status varchar(12) NOT NULL DEFAULT 'formed' CHECK(status IN ('formed','started','completed','disbanded')),
  instance_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS dungeon_queue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  realm_id varchar(24) NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  dungeon_id varchar(64) NOT NULL REFERENCES dungeon_catalog(id),
  role varchar(8) NOT NULL CHECK(role IN ('tank','healer','damage')),
  character_level integer NOT NULL CHECK(character_level BETWEEN 1 AND 720),
  status varchar(12) NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','matched','cancelled','completed')),
  group_id uuid REFERENCES dungeon_match_groups(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  matched_at timestamptz,
  cancelled_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS dungeon_queue_one_active_character
  ON dungeon_queue_entries(character_id) WHERE status IN ('queued','matched');
CREATE INDEX IF NOT EXISTS dungeon_queue_match_candidates
  ON dungeon_queue_entries(realm_id,dungeon_id,role,created_at,id) WHERE status='queued';
CREATE INDEX IF NOT EXISTS dungeon_queue_account_history
  ON dungeon_queue_entries(account_id,created_at DESC);
CREATE TABLE IF NOT EXISTS dungeon_match_members (
  group_id uuid NOT NULL REFERENCES dungeon_match_groups(id) ON DELETE CASCADE,
  queue_entry_id uuid NOT NULL UNIQUE REFERENCES dungeon_queue_entries(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  role varchar(8) NOT NULL CHECK(role IN ('tank','healer','damage')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(group_id,character_id)
);
CREATE INDEX IF NOT EXISTS dungeon_match_members_character
  ON dungeon_match_members(character_id,group_id);
