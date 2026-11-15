# GB-Quest Unreal Engine 5.7

This directory establishes the UE 5.7 C++ and content-production target for GB-Quest.

## Planned module layout
- `Source/GBQuest`: replicated gameplay runtime module.
- `Source/GBQuestEditor`: editor-only asset validation and authoring helpers.
- `Content/GBQuest/Blueprints`: player, NPC, enemy, boss, interaction and UI Blueprints.
- `Content/GBQuest/Data`: primary data assets and data tables.
- `Content/GBQuest/Cinematic`: imported high-resolution meshes, textures, materials and animation assets.
- `Content/GBQuest/UI`: HUD, character creation, inventory, equipment, maps and menus.

## Integration
1. Create/open a UE 5.7 C++ project.
2. Copy the `Source/GBQuest` module into its `Source` directory.
3. Add the module to the project target and regenerate project files.
4. Compile with the UE 5.7 toolchain.
5. Run `Tools/Unreal/generate_gbquest_content.py` in the Unreal Editor Python console to create the content folder structure and starter data assets.

## Art source convention
Approved source assets go in `Content/GBQuest/ArtSource/<category>/<asset-id>.<ext>`. Use the cinematic importer to bring approved textures and meshes into the project. Existing browser sprites are retained as a legacy mode.

This is a staged foundation, not a claim that all 6,000 production-ready meshes, textures, rigs and animations already exist. MMO persistence, authentication, matchmaking, anti-cheat and dedicated-server infrastructure require separate implementation.