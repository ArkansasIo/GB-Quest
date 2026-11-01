# 350 bosses, monster taxonomy and large 8-bit world

## Boss catalogue
The boss registry contains exactly 350 original encounters:
- 300 world bosses distributed across 40 zones.
- 50 arc bosses designed as major raid/story milestones.
- Each entry identifies a D&D-style creature type, an original monster combat class and subclass, zone, level band, target challenge rating, party size, mechanics, loot tier and respawn cadence.

The 14 creature type labels follow the D&D 5e taxonomy: Aberration, Beast, Celestial, Construct, Dragon, Elemental, Fey, Fiend, Giant, Humanoid, Monstrosity, Ooze, Plant and Undead. Monster classes and subclasses are original GB Quest combat-role archetypes, not additional official D&D character classes. CR values are encounter-tuning targets only; each monster still needs a complete tested stat block.

## World map scale
The first world-scale target is 4 continents, 10 zones per continent and 40 zones total.
- Each zone: 512 x 512 logical tiles.
- Each tile: 16 x 16 source pixels.
- Whole world: 2,048 x 5,120 tiles, or 32,768 x 81,920 source pixels.
- Chunk: 32 x 32 tiles.
- Each zone: 16 x 16 chunks; world total: 10,240 chunks.
- Legacy handheld viewport: 160 x 144 pixels, with integer nearest-neighbor zoom.

The 40 zones form a 4 x 10 grid. This produces a very large seamless-feeling world without loading all map pixels or entities at once. The client loads nearby chunks and the server remains authoritative for collision, creatures, combat and loot.

## World layout
The four original continents are Westreach, Highcrown, Sunscar and Umbraldeep. Each continent occupies a 2 x 5 zone block in the 4 x 10 world grid, with distinct biomes, settlements, dungeons, travel routes and boss arenas. Zone level ranges are distributed across the 1-720 character journey.

## 8-bit presentation
- Top-down tile-based world, 16px base tiles.
- Original tilesets and sprite sheets at 8, 16, 24, 32 and 48px logical sizes.
- 4-shade Game Boy profile and expanded 8-bit palette profile.
- Nearest-neighbor rendering and integer zoom only.
- Layered sprites for species, class outfit, armor, weapon and cosmetic effects.

## Important content boundary
The monster type taxonomy is D&D-inspired and the project can implement open SRD rules with attribution. The 350 boss identities, names, encounter designs, maps, zones and pixel art are original GB Quest material. Do not copy World of Warcraft maps, models, sprites, music, UI or quest text.
