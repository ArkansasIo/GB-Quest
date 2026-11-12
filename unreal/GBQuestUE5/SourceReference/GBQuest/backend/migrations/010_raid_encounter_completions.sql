-- Idempotency ledger for server-confirmed raid boss completions.
CREATE TABLE IF NOT EXISTS raid_encounter_completions (
  id uuid PRIMARY KEY,
  raid_group_id uuid NOT NULL REFERENCES raid_groups(id) ON DELETE CASCADE,
  encounter_id varchar(48) NOT NULL,
  difficulty varchar(16) NOT NULL CHECK (difficulty IN ('story','normal','heroic','mythic')),
  completed_at timestamptz NOT NULL DEFAULT now(),
  reset_at timestamptz NOT NULL,
  member_count integer NOT NULL CHECK (member_count > 0),
  UNIQUE (raid_group_id,encounter_id,difficulty)
);
CREATE INDEX IF NOT EXISTS raid_encounter_completions_reset_idx
  ON raid_encounter_completions(reset_at);
