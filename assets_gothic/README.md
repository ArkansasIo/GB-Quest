# GB-Quest Dark Fantasy Replacement Art Pack

This folder defines the reproducible extraction pipeline for the six new reference sheets supplied for GB-Quest.

- Six source sheets are preserved as source references.
- Category crops cover characters/monsters, weapons/armor, skills, biomes, dungeon interiors, UI, world blocks, and expansion gear.
- `asset-manifest.json` records exact source/crop coordinates.
- `tools/build_gothic_art_pack.py` regenerates the category atlases from the six JPG source sheets.

**Important:** these are composite catalog sheets, not isolated transparent sprites. Category crops retain some borders, captions, and mockup material. They must be cleaned into individual transparent sprites and animation frames before replacing runtime files. Keep the existing runtime pack until each replacement is validated.
