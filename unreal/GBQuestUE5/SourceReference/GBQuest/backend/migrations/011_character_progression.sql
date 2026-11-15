-- Persistent server-owned character progression. Safe to reapply.
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS talent_points integer NOT NULL DEFAULT 0 CHECK (talent_points BETWEEN 0 AND 1000),
  ADD COLUMN IF NOT EXISTS allocated_attributes jsonb NOT NULL DEFAULT '{"str":0,"dex":0,"con":0,"int":0,"wis":0,"vit":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS unlocked_talents jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_allocated_attributes_object;
ALTER TABLE characters ADD CONSTRAINT characters_allocated_attributes_object
  CHECK (jsonb_typeof(allocated_attributes)='object');
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_unlocked_talents_array;
ALTER TABLE characters ADD CONSTRAINT characters_unlocked_talents_array
  CHECK (jsonb_typeof(unlocked_talents)='array');
