-- Durable same-realm direct messages. Messages are retained for 30 days.
CREATE TABLE IF NOT EXISTS player_whispers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id varchar(24) NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  sender_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  recipient_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  message varchar(180) NOT NULL CHECK (length(btrim(message)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CHECK (sender_character_id <> recipient_character_id)
);
CREATE INDEX IF NOT EXISTS player_whispers_inbox_idx
  ON player_whispers(recipient_character_id, created_at DESC);
CREATE INDEX IF NOT EXISTS player_whispers_conversation_idx
  ON player_whispers(realm_id, sender_character_id, recipient_character_id, created_at DESC);
CREATE INDEX IF NOT EXISTS player_whispers_expiry_idx
  ON player_whispers(created_at);
