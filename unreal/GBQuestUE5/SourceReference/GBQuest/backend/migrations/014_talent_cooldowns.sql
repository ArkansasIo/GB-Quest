-- Persist per-character talent ability cooldowns across reconnects and service instances.
CREATE TABLE IF NOT EXISTS character_talent_cooldowns (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  node_id varchar(80) NOT NULL REFERENCES mmorpg_talent_nodes(id) ON DELETE CASCADE,
  ready_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(character_id,node_id)
);
CREATE INDEX IF NOT EXISTS character_talent_cooldowns_ready_idx
  ON character_talent_cooldowns(ready_at);

UPDATE mmorpg_talent_nodes
SET effect = effect || jsonb_build_object(
  'cooldownSeconds', CASE
    WHEN node_type='ultimate' THEN 90
    WHEN node_type='active' THEN 8 + (node_index / 3)
    ELSE 0
  END
);
