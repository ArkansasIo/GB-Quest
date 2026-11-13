-- Server-authoritative seasonal progression, weekly objectives and idempotent reward claims.
CREATE TABLE IF NOT EXISTS character_season_progress (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  season_id varchar(32) NOT NULL,
  season_start date NOT NULL,
  season_end date NOT NULL,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(stats)='object'),
  journey_chapter smallint NOT NULL DEFAULT 1 CHECK (journey_chapter BETWEEN 1 AND 13),
  journey_base jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(journey_base)='object'),
  weekly_start date NOT NULL,
  weekly_base jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(weekly_base)='object'),
  weekly_claimed jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(weekly_claimed)='array'),
  claimed_renown jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(claimed_renown)='array'),
  currency integer NOT NULL DEFAULT 0 CHECK (currency BETWEEN 0 AND 999999),
  season_xp integer NOT NULL DEFAULT 0 CHECK (season_xp >= 0),
  renown integer NOT NULL DEFAULT 0 CHECK (renown >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(character_id,season_id)
);
CREATE INDEX IF NOT EXISTS character_season_progress_rank_idx
  ON character_season_progress(season_id,season_xp DESC,renown DESC);
