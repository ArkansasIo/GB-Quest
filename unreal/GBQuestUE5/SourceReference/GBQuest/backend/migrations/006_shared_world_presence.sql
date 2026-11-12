-- Shared online-player leases across MMO service instances.
-- Each open authenticated character socket owns one lease, renewed by the server heartbeat.
CREATE TABLE IF NOT EXISTS world_presence (
  socket_id uuid PRIMARY KEY,
  server_instance_id varchar(128) NOT NULL,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  realm_id varchar(24) NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  zone_id varchar(48) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS world_presence_realm_expiry_idx
  ON world_presence(realm_id, expires_at);
CREATE INDEX IF NOT EXISTS world_presence_zone_expiry_idx
  ON world_presence(realm_id, zone_id, expires_at);
CREATE INDEX IF NOT EXISTS world_presence_instance_idx
  ON world_presence(server_instance_id);
DELETE FROM world_presence WHERE expires_at <= now();
