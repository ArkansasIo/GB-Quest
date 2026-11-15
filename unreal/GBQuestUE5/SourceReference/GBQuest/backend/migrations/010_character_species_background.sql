-- Persist the complete browser game's playable species and character backgrounds on online characters.
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS species varchar(16) NOT NULL DEFAULT 'hearthkin',
  ADD COLUMN IF NOT EXISTS background varchar(16) NOT NULL DEFAULT 'wanderer';

ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_species_check;
ALTER TABLE characters ADD CONSTRAINT characters_species_check CHECK (species IN (
  'hearthkin','thornelf','stonekin','wispling','emberborn','burrowkin','twinblood','tuskborn','drakkin',
  'hornfolk','felinar','pipkin','lunari','wolfkin','starkin'
));

ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_background_check;
ALTER TABLE characters ADD CONSTRAINT characters_background_check CHECK (background IN (
  'soldier','scholar','wanderer','urchin','acolyte','envoy'
));
