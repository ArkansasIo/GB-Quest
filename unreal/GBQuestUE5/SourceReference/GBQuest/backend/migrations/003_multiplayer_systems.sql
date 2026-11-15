-- GB Quest persistent multiplayer domain schema. Additive and idempotent.
CREATE TABLE IF NOT EXISTS parties (
 id uuid PRIMARY KEY, realm_id varchar(24) NOT NULL REFERENCES realms(id),
 leader_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 name varchar(40), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS party_members (
 party_id uuid NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 role varchar(12) NOT NULL DEFAULT 'damage' CHECK(role IN ('tank','healer','damage','support')),
 joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(party_id,character_id), UNIQUE(character_id)
);
CREATE INDEX IF NOT EXISTS party_members_character_idx ON party_members(character_id);
CREATE TABLE IF NOT EXISTS party_invites (
 id uuid PRIMARY KEY, party_id uuid NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
 inviter_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 invitee_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 status varchar(12) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','expired','cancelled')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS party_invites_inbox_idx ON party_invites(invitee_character_id,status,expires_at);
CREATE TABLE IF NOT EXISTS guilds (
 id uuid PRIMARY KEY, realm_id varchar(24) NOT NULL REFERENCES realms(id),
 name varchar(32) NOT NULL, name_key varchar(32) NOT NULL, motd varchar(180) NOT NULL DEFAULT '',
 leader_character_id uuid NOT NULL REFERENCES characters(id), bank_gold bigint NOT NULL DEFAULT 0 CHECK(bank_gold>=0),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(realm_id,name_key)
);
CREATE TABLE IF NOT EXISTS guild_members (
 guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 rank varchar(16) NOT NULL DEFAULT 'member' CHECK(rank IN ('leader','officer','veteran','member','recruit')),
 joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(guild_id,character_id), UNIQUE(character_id)
);
CREATE INDEX IF NOT EXISTS guild_members_character_idx ON guild_members(character_id);
CREATE TABLE IF NOT EXISTS guild_permissions(rank varchar(16) NOT NULL, permission varchar(32) NOT NULL, PRIMARY KEY(rank,permission));
INSERT INTO guild_permissions(rank,permission) VALUES
 ('leader','invite'),('leader','kick'),('leader','promote'),('leader','motd'),('leader','bank_deposit'),('leader','bank_withdraw'),('leader','disband'),
 ('officer','invite'),('officer','kick'),('officer','motd'),('officer','bank_deposit'),('veteran','invite'),('member','bank_deposit')
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS dungeon_instances (
 id uuid PRIMARY KEY, realm_id varchar(24) NOT NULL REFERENCES realms(id), dungeon_id varchar(48) NOT NULL,
 party_id uuid REFERENCES parties(id) ON DELETE SET NULL,
 difficulty varchar(16) NOT NULL DEFAULT 'normal' CHECK(difficulty IN ('story','normal','heroic','mythic')),
 status varchar(16) NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','failed','closed')),
 seed bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS dungeon_instance_members (
 instance_id uuid NOT NULL REFERENCES dungeon_instances(id) ON DELETE CASCADE,
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 entered_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(instance_id,character_id)
);
CREATE INDEX IF NOT EXISTS dungeon_instances_realm_status_idx ON dungeon_instances(realm_id,status,expires_at);
CREATE TABLE IF NOT EXISTS raid_lockouts (
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE, raid_id varchar(48) NOT NULL,
 difficulty varchar(16) NOT NULL, reset_at timestamptz NOT NULL, completed_at timestamptz,
 PRIMARY KEY(character_id,raid_id,difficulty)
);
CREATE TABLE IF NOT EXISTS ready_checks (
 id uuid PRIMARY KEY, party_id uuid NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
 started_by uuid NOT NULL REFERENCES characters(id), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ready_check_responses (
 ready_check_id uuid NOT NULL REFERENCES ready_checks(id) ON DELETE CASCADE,
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 ready boolean NOT NULL, responded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(ready_check_id,character_id)
);
CREATE TABLE IF NOT EXISTS player_friends (
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 friend_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 status varchar(12) NOT NULL DEFAULT 'accepted' CHECK(status IN ('pending','accepted','blocked')),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(character_id,friend_character_id), CHECK(character_id<>friend_character_id)
);
CREATE TABLE IF NOT EXISTS player_mail (
 id uuid PRIMARY KEY, realm_id varchar(24) NOT NULL REFERENCES realms(id),
 sender_character_id uuid REFERENCES characters(id) ON DELETE SET NULL,
 recipient_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 subject varchar(80) NOT NULL DEFAULT '', body varchar(2000) NOT NULL DEFAULT '',
 attachments jsonb NOT NULL DEFAULT '[]'::jsonb, gold bigint NOT NULL DEFAULT 0 CHECK(gold>=0),
 claimed_at timestamptz, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS player_mail_inbox_idx ON player_mail(recipient_character_id,created_at DESC);
CREATE TABLE IF NOT EXISTS auction_listings (
 id uuid PRIMARY KEY, realm_id varchar(24) NOT NULL REFERENCES realms(id),
 seller_character_id uuid NOT NULL REFERENCES characters(id), item_id varchar(48) NOT NULL REFERENCES item_catalog(id),
 quantity integer NOT NULL CHECK(quantity>0), buyout_gold bigint NOT NULL CHECK(buyout_gold>0),
 deposit_gold bigint NOT NULL DEFAULT 0 CHECK(deposit_gold>=0),
 status varchar(12) NOT NULL DEFAULT 'active' CHECK(status IN ('active','sold','cancelled','expired')),
 expires_at timestamptz NOT NULL, buyer_character_id uuid REFERENCES characters(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auction_search_idx ON auction_listings(realm_id,item_id,buyout_gold) WHERE status='active';
CREATE TABLE IF NOT EXISTS economy_ledger (
 id bigserial PRIMARY KEY, realm_id varchar(24) NOT NULL REFERENCES realms(id),
 character_id uuid REFERENCES characters(id), counterparty_character_id uuid REFERENCES characters(id),
 event_type varchar(32) NOT NULL, currency varchar(12) NOT NULL DEFAULT 'gold', amount bigint NOT NULL,
 reference_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS economy_ledger_character_idx ON economy_ledger(character_id,created_at DESC);
CREATE TABLE IF NOT EXISTS pvp_matches (
 id uuid PRIMARY KEY, realm_id varchar(24) NOT NULL REFERENCES realms(id),
 mode varchar(16) NOT NULL CHECK(mode IN ('duel','arena_2v2','arena_3v3','battleground')),
 status varchar(16) NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','active','completed','cancelled')),
 team_a jsonb NOT NULL DEFAULT '[]'::jsonb, team_b jsonb NOT NULL DEFAULT '[]'::jsonb,
 rating_delta jsonb NOT NULL DEFAULT '{}'::jsonb, started_at timestamptz, ended_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pvp_ratings (
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE, bracket varchar(16) NOT NULL,
 rating integer NOT NULL DEFAULT 1000, wins integer NOT NULL DEFAULT 0, losses integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(character_id,bracket)
);
CREATE TABLE IF NOT EXISTS player_reports (
 id uuid PRIMARY KEY, reporter_character_id uuid NOT NULL REFERENCES characters(id),
 reported_character_id uuid NOT NULL REFERENCES characters(id),
 category varchar(24) NOT NULL CHECK(category IN ('harassment','cheating','spam','exploiting','other')),
 details varchar(1000) NOT NULL DEFAULT '', status varchar(16) NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved','dismissed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS player_reports_queue_idx ON player_reports(status,created_at);
