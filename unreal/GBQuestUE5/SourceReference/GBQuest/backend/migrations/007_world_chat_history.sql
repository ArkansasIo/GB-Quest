-- Durable realm and zone chat history.
CREATE TABLE IF NOT EXISTS world_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id varchar(24) NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  zone_id varchar(48),
  channel varchar(8) NOT NULL CHECK (channel IN ('zone','realm')),
  sender_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  message varchar(180) NOT NULL CHECK (length(btrim(message)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((channel = 'zone' AND zone_id IS NOT NULL) OR (channel = 'realm' AND zone_id IS NULL))
);
CREATE INDEX IF NOT EXISTS world_chat_realm_history_idx
  ON world_chat_messages(realm_id, created_at DESC) WHERE channel = 'realm';
CREATE INDEX IF NOT EXISTS world_chat_zone_history_idx
  ON world_chat_messages(realm_id, zone_id, created_at DESC) WHERE channel = 'zone';
