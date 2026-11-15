-- Align authoritative PostgreSQL character progression with the browser game's 27 jobs and level 1–720 curve.
-- Existing six-class accounts are mapped to their closest current job before the stricter constraint is applied.
ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_class_check;
UPDATE characters
SET class = CASE class
  WHEN 'warrior' THEN 'warden'
  WHEN 'mage' THEN 'arcanist'
  WHEN 'ranger' THEN 'strider'
  WHEN 'cleric' THEN 'chaplain'
  WHEN 'rogue' THEN 'shade'
  WHEN 'adventurer' THEN 'warden'
  ELSE class
END
WHERE class IN ('warrior','mage','ranger','cleric','rogue','adventurer');

ALTER TABLE characters
  ADD CONSTRAINT characters_class_check CHECK (class IN (
    'warden','berserker','vanguard','strider','shade','ascetic','arcanist','wildblood',
    'pactbound','cantor','chaplain','verdant','necromancer','summoner','sunwarden','runeblade',
    'ronin','shinobi','bladedancer','wyrmlancer','corsair','beastcaller','puppeteer',
    'dreadknight','voidhunter','scalesage','stormcaller',
    'warrior','mage','ranger','cleric','rogue','adventurer'
  ));

ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_level_check;
ALTER TABLE characters ADD CONSTRAINT characters_level_check CHECK (level BETWEEN 1 AND 720);

ALTER TABLE world_mobs DROP CONSTRAINT IF EXISTS world_mobs_level_check;
ALTER TABLE world_mobs ADD CONSTRAINT world_mobs_level_check CHECK (level BETWEEN 1 AND 720);

ALTER TABLE item_catalog DROP CONSTRAINT IF EXISTS item_catalog_level_required_check;
ALTER TABLE item_catalog ADD CONSTRAINT item_catalog_level_required_check CHECK (level_required BETWEEN 1 AND 720);

-- The browser rules use the original 5e XP thresholds through level 20, then a cubic ascension curve.
CREATE OR REPLACE FUNCTION gbq_level_for_xp(total_xp bigint)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  current_level integer := 1;
  target_level integer;
  ascension_level numeric;
  required_xp bigint;
  base_thresholds bigint[] := ARRAY[
    0,300,900,2700,6500,14000,23000,34000,48000,64000,
    85000,100000,120000,140000,165000,195000,225000,265000,305000,355000
  ];
BEGIN
  WHILE current_level < 720 LOOP
    target_level := current_level + 1;
    IF target_level <= 20 THEN
      required_xp := base_thresholds[target_level];
    ELSE
      ascension_level := target_level - 20;
      required_xp := 355000 + round(
        30000 * ascension_level
        + 900 * power(ascension_level, 2)
        + 2.2 * power(ascension_level, 3)
      )::bigint;
    END IF;
    EXIT WHEN COALESCE(total_xp, 0) < required_xp;
    current_level := target_level;
  END LOOP;
  RETURN current_level;
END;
$$;

-- Keep pre-existing level values intact while ensuring newly awarded XP uses the shared 720-level curve.
UPDATE characters SET level = GREATEST(level, gbq_level_for_xp(xp));
