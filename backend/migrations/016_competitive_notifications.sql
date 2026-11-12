-- Competitive arena/battleground queues and durable player notifications.
CREATE TABLE IF NOT EXISTS player_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  character_id uuid REFERENCES characters(id) ON DELETE CASCADE,
  event_type varchar(48) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX IF NOT EXISTS player_notifications_inbox
  ON player_notifications(account_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS player_notifications_expiry ON player_notifications(expires_at);

CREATE TABLE IF NOT EXISTS competitive_queue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  realm_id varchar(24) NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  mode varchar(24) NOT NULL CHECK (mode IN ('arena_2v2','arena_3v3','battleground_10v10')),
  rating integer NOT NULL DEFAULT 1000 CHECK (rating BETWEEN 0 AND 5000),
  status varchar(12) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','matched','cancelled','expired','completed')),
  match_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);
CREATE UNIQUE INDEX IF NOT EXISTS competitive_queue_one_active
  ON competitive_queue_entries(character_id) WHERE status IN ('queued','matched');
CREATE INDEX IF NOT EXISTS competitive_queue_candidates
  ON competitive_queue_entries(realm_id,mode,rating,created_at)
  WHERE status='queued';

CREATE TABLE IF NOT EXISTS competitive_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id varchar(24) NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  mode varchar(24) NOT NULL CHECK (mode IN ('arena_2v2','arena_3v3','battleground_10v10')),
  status varchar(12) NOT NULL DEFAULT 'matched' CHECK (status IN ('matched','active','completed','cancelled')),
  instance_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  winning_team smallint CHECK (winning_team IN (1,2))
);
ALTER TABLE competitive_queue_entries DROP CONSTRAINT IF EXISTS competitive_queue_entries_match_id_fkey;
ALTER TABLE competitive_queue_entries ADD CONSTRAINT competitive_queue_entries_match_id_fkey
  FOREIGN KEY (match_id) REFERENCES competitive_matches(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS competitive_match_members (
  match_id uuid NOT NULL REFERENCES competitive_matches(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  queue_entry_id uuid NOT NULL UNIQUE REFERENCES competitive_queue_entries(id) ON DELETE CASCADE,
  team smallint NOT NULL CHECK (team IN (1,2)),
  rating_at_match integer NOT NULL CHECK (rating_at_match BETWEEN 0 AND 5000),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(match_id,character_id)
);
CREATE INDEX IF NOT EXISTS competitive_match_members_character
  ON competitive_match_members(character_id,match_id);
