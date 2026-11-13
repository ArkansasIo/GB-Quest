-- Explicit server-owned enemy classification for elite and world-boss seasonal objectives.
ALTER TABLE world_mobs
  ADD COLUMN IF NOT EXISTS mob_rank varchar(16) NOT NULL DEFAULT 'normal';

ALTER TABLE world_mobs
  DROP CONSTRAINT IF EXISTS world_mobs_mob_rank_check;

ALTER TABLE world_mobs
  ADD CONSTRAINT world_mobs_mob_rank_check
  CHECK (mob_rank IN ('normal','elite','world_boss'));

CREATE INDEX IF NOT EXISTS world_mobs_rank_alive_idx
  ON world_mobs(realm_id, mob_rank, alive);
