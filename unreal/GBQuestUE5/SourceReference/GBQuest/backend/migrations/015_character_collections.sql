-- Durable, per-character collection ownership and equipped cosmetic selections.
CREATE TABLE IF NOT EXISTS character_collections (
  character_id uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{"mounts":[],"pets":[],"titles":[],"appearances":[],"achievements":[],"activeMount":null,"activePet":null,"activeTitle":null,"points":0}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT character_collections_state_object CHECK (jsonb_typeof(state) = 'object')
);
CREATE INDEX IF NOT EXISTS character_collections_updated_idx
  ON character_collections(updated_at);
