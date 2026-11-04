# Cinematic asset production: prompt catalog and Unreal importer

Generate the 6,000 individually seeded visual briefs:

```bash
python tools/generate_cinematic_asset_prompts.py
```

Output: `data/visuals/cinematic_asset_prompts.csv`. Every row has a stable `GBQ-CIN-####` ID, category, unique seed, detailed art prompt, negative prompt, target resolution, texture-map requirements, and expected source filename.

The CSV contains **production briefs, not rendered images**. Use it as the input queue for a compatible image/model-generation workflow or an art team. Hero characters, weapons, armor, bosses, and open-world vistas should be authored as 3D assets with PBR texture sets; a single 2D concept render is not a substitute for a game-ready mesh.

## Unreal Engine 5.7 import

Place approved output files at:

`Content/GBQuest/ArtSource/<category>/<asset_id>.<extension>`

Supported source extensions: PNG/TIFF/JPG/EXR and FBX/glTF. In Unreal Editor, run `Tools/Unreal/import_cinematic_assets.py` through the Python console. It imports only present files into `/Game/GBQuest/Cinematic/<category>`, writes an import report, and does not delete legacy assets.

Review imported materials, skeletons, collisions, LODs, texture compression, and platform memory before enabling any replacement in gameplay.
