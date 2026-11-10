-- Persistent per-character collection unlocks and active vanity selections.
CREATE TABLE IF NOT EXISTS character_collections (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{"mounts":[],"pets":[],"titles":[],"appearances":[],"achievements":[],"activeMount":null,"activePet":null,"activeTitle":null,"points":0}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT character_collections_state_object CHECK (jsonb_typeof(state) = 'object')
);
CREATE INDEX IF NOT EXISTS character_collections_updated_idx ON character_collections(updated_at);
