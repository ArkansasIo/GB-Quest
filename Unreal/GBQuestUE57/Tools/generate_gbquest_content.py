"""Generate the GB-Quest UE5.7 content skeleton from the cinematic asset budget.

Run inside the Unreal Editor Python console. This creates folders and Blueprint
asset shells only; it does not fabricate finished meshes, textures, rigs or animation.
"""
import json
import os
import unreal

PROJECT_DIR = unreal.Paths.project_dir()
REPO_ROOT = os.path.abspath(os.path.join(PROJECT_DIR, "..", ".."))
BUDGET_CANDIDATES = [
    os.path.join(PROJECT_DIR, "data", "visuals", "cinematic_asset_budget.json"),
    os.path.join(REPO_ROOT, "data", "visuals", "cinematic_asset_budget.json"),
]
BUDGET_PATH = next((p for p in BUDGET_CANDIDATES if os.path.isfile(p)), None)
if not BUDGET_PATH:
    raise RuntimeError("Could not locate data/visuals/cinematic_asset_budget.json")

with open(BUDGET_PATH, "r", encoding="utf-8") as handle:
    budget = json.load(handle)

ROOT = "/Game/GBQuest"
FOLDERS = [
    "Blueprints/Core", "Blueprints/Characters", "Blueprints/Classes",
    "Blueprints/Races", "Blueprints/Enemies", "Blueprints/Bosses",
    "Blueprints/NPCs", "Blueprints/Items", "Blueprints/Abilities",
    "Blueprints/AI", "Blueprints/World", "Blueprints/Interactions",
    "Blueprints/UI", "Data/Primary", "Data/DataTables", "Data/Enums",
    "Data/GameplayTags", "UI/HUD", "UI/Menus", "UI/CharacterCreation",
    "UI/Inventory", "UI/Equipment", "UI/Maps", "UI/QuestLog",
    "Cinematic/Characters", "Cinematic/Weapons", "Cinematic/Armor",
    "Cinematic/Creatures", "Cinematic/Bosses", "Cinematic/Environments",
    "Cinematic/Props", "Cinematic/Vegetation", "Cinematic/VFX",
    "Cinematic/Animation", "Cinematic/Materials", "Cinematic/Textures",
    "World/Biomes", "World/Towns", "World/Dungeons", "World/Landmarks",
    "Audio/Music", "Audio/SFX", "Audio/Dialogue", "ArtSource",
    "Legacy/PixelArt"
]

for relative in FOLDERS:
    unreal.EditorAssetLibrary.make_directory(f"{ROOT}/{relative}")

# Create a manifest in the project so the editor can track the full art backlog.
manifest = {
    "engine": "Unreal Engine 5.7",
    "target_asset_count": int(budget["total_assets"]),
    "categories": budget["categories"],
    "source_art_status": "not_generated",
    "generated_by": "GB-Quest content skeleton generator"
}
manifest_path = os.path.join(PROJECT_DIR, "Saved", "GBQuestAssetManifest.json")
os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
with open(manifest_path, "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, indent=2)

unreal.log("GB-Quest UE5.7 content folders created.")
unreal.log(f"Asset target: {manifest['target_asset_count']} across {len(manifest['categories'])} categories.")
unreal.log("No existing content was deleted or overwritten.")
