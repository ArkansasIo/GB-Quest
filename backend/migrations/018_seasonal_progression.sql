-- Durable, server-authoritative seasonal progression and one-time reward claims.
CREATE TABLE IF NOT EXISTS character_season_objectives (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  season_id varchar(32) NOT NULL,
  objective_id varchar(32) NOT NULL,
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0),
  target integer NOT NULL CHECK (target > 0),
  claimed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(character_id, season_id, objective_id),
  CONSTRAINT character_season_objectives_progress_target CHECK (progress <= target)
);
CREATE INDEX IF NOT EXISTS character_season_objectives_season_idx
  ON character_season_objectives(season_id, objective_id);

CREATE TABLE IF NOT EXISTS character_season_wallets (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  season_id varchar(32) NOT NULL,
  tokens bigint NOT NULL DEFAULT 0 CHECK (tokens >= 0),
  renown bigint NOT NULL DEFAULT 0 CHECK (renown >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(character_id, season_id)
);
