"""Clone GB-Quest source, import its image assets, and create Blueprint port scaffolds.

Run inside the Unreal Editor with:
    UnrealEditor.exe GBQuestUE5.uproject -ExecutePythonScript=create_blueprints.py

This is an importer/scaffolder, not a JavaScript-to-Blueprint transpiler. It keeps
the browser source as a reference, imports images as Texture2D assets, creates
empty Blueprint classes for the port, and writes a per-file conversion manifest.
Gameplay behavior still needs to be implemented in Blueprint graphs.
"""

import json
import os
import shutil
import traceback

import unreal


PROJECT_DIR = os.path.abspath(unreal.Paths.project_dir())
PROJECT_ROOT = os.path.dirname(PROJECT_DIR.rstrip("\\/"))
REPOSITORY_ROOT = os.path.dirname(PROJECT_ROOT)
SOURCE_REFERENCE_DIR = os.path.join(PROJECT_DIR, "SourceReference", "GBQuest")
MANIFEST_PATH = os.path.join(PROJECT_DIR, "BlueprintPortManifest.json")

CONTENT_ROOT = "/Game/GBQuest"
ART_CONTENT_ROOT = CONTENT_ROOT + "/Art"
BLUEPRINT_CONTENT_ROOT = CONTENT_ROOT + "/Blueprints"

SOURCE_EXTENSIONS = {
    ".c", ".cc", ".cpp", ".cs", ".css", ".gd", ".h", ".hpp", ".html",
    ".ini", ".js", ".json", ".md", ".mjs", ".py", ".ps1", ".sh",
    ".toml", ".ts", ".tsx", ".txt", ".xml", ".yaml", ".yml",
}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tga", ".bmp"}
EXCLUDED_DIRS = {
    ".agents", ".aws", ".codex", ".git", ".github", ".vscode",
    "build", "dist", "node_modules", "unreal",
}
IMPORT_BATCH_SIZE = 150


def log(message):
    unreal.log("[GBQuest Port] " + str(message))


def source_root():
    """Resolve the repository even when the project is moved as a whole."""
    candidate = REPOSITORY_ROOT
    if os.path.isfile(os.path.join(candidate, "index.html")) and os.path.isdir(os.path.join(candidate, "src")):
        return candidate
    current = PROJECT_DIR
    while current and current != os.path.dirname(current):
        if os.path.isfile(os.path.join(current, "index.html")) and os.path.isdir(os.path.join(current, "src")):
            return current
        current = os.path.dirname(current)
    raise RuntimeError("Could not locate the GB-Quest repository (expected index.html and src/).")


def ensure_folder(path):
    os.makedirs(path, exist_ok=True)


def iter_source_files(root):
    for current, dirs, files in os.walk(root):
        dirs[:] = [name for name in dirs if name.lower() not in EXCLUDED_DIRS]
        for filename in files:
            full_path = os.path.join(current, filename)
            extension = os.path.splitext(filename)[1].lower()
            if extension in SOURCE_EXTENSIONS:
                yield full_path


def copy_source_tree(root):
    ensure_folder(SOURCE_REFERENCE_DIR)
    copied = []
    for source_path in iter_source_files(root):
        relative_path = os.path.relpath(source_path, root)
        target_path = os.path.join(SOURCE_REFERENCE_DIR, relative_path)
        ensure_folder(os.path.dirname(target_path))
        if (not os.path.isfile(target_path)
                or os.path.getsize(source_path) != os.path.getsize(target_path)
                or os.path.getmtime(source_path) > os.path.getmtime(target_path)):
            shutil.copy2(source_path, target_path)
        copied.append((relative_path.replace("\\", "/"), source_path))
    log("Cloned {} source/reference files into {}".format(len(copied), SOURCE_REFERENCE_DIR))
    return copied


def suggested_blueprint(relative_path):
    path = relative_path.replace("\\", "/").lower()
    name = os.path.basename(path)
    stem = os.path.splitext(name)[0]
    if "/mmorpg/rules/" in path or stem in {"rules", "data_rules"}:
        return "BP_GBQ_RulesComponent"
    if "/mmorpg/progression/" in path or "progression" in stem:
        return "BPFL_GBQ_Progression"
    if "/mmorpg/systems/" in path or stem in {"systems", "inventory", "quests", "economy"}:
        return "BP_GBQ_GameSystems"
    if stem in {"combat", "battle"}:
        return "BP_GBQ_BattleManager"
    if "scenes_world" in stem:
        return "WBP_GBQ_WorldFlow"
    if "scenes_menu" in stem or "ui_" in stem:
        return "WBP_GBQ_Menus"
    if stem in {"engine", "video64", "art", "audio64"}:
        return "BP_GBQ_Presentation"
    if stem.startswith("data_") or "/data/" in path:
        return "DT_GBQ_GameData"
    if "backend/" in path or "server/" in path:
        return "BP_GBQ_OnlineServices (server-authoritative port)"
    if path.startswith("client/") or name == "index.html":
        return "WBP_GBQ_BootFlow"
    return "BP_GBQ_" + "".join(part.title() for part in stem.replace("-", "_").split("_"))


def source_manifest(source_files):
    return [{
        "source": relative,
        "reference_copy": "SourceReference/GBQuest/" + relative,
        "suggested_unreal_destination": suggested_blueprint(relative),
        "status": "reference_copied_logic_not_translated",
    } for relative, _ in source_files]


def image_roots(root):
    candidates = [
        ("assets", os.path.join(root, "assets")),
        ("assets_hd64", os.path.join(root, "assets_hd64")),
        ("assets_pack", os.path.join(root, "assets_pack")),
        ("assets_preview", os.path.join(root, "assets_preview")),
        ("generated", os.path.join(PROJECT_DIR, "SourceArt", "Final")),
    ]
    return [(label, path) for label, path in candidates if os.path.isdir(path)]


def iter_images(root):
    for current, dirs, files in os.walk(root):
        dirs.sort()
        for filename in sorted(files):
            path = os.path.join(current, filename)
            if os.path.splitext(filename)[1].lower() in IMAGE_EXTENSIONS:
                yield path


def set_pixel_import_defaults(asset):
    """Apply crisp 2D texture settings where that property exists in this UE build."""
    texture_class = getattr(unreal, "Texture2D", None)
    texture_filter = getattr(unreal, "TextureFilter", None)
    if not texture_class or not isinstance(asset, texture_class) or not texture_filter:
        return
    try:
        asset.set_editor_property("filter", texture_filter.NEAREST)
    except Exception as error:
        log("Texture imported; could not set nearest filtering on {}: {}".format(asset.get_name(), error))


def import_art(root):
    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    tasks = []
    source_image_count = 0
    for label, folder in image_roots(root):
        for image_path in iter_images(folder):
            relative_dir = os.path.relpath(os.path.dirname(image_path), folder)
            destination = ART_CONTENT_ROOT + "/" + label
            if relative_dir != ".":
                destination += "/" + relative_dir.replace("\\", "/")
            unreal.EditorAssetLibrary.make_directory(destination)
            task = unreal.AssetImportTask()
            task.set_editor_property("filename", image_path)
            task.set_editor_property("destination_path", destination)
            task.set_editor_property("automated", True)
            task.set_editor_property("replace_existing", False)
            tasks.append(task)
            source_image_count += 1

            if len(tasks) >= IMPORT_BATCH_SIZE:
                asset_tools.import_asset_tasks(tasks)
                tasks = []

    if tasks:
        asset_tools.import_asset_tasks(tasks)

    # Set crisp nearest-neighbour sampling for imported pixel art and save the assets.
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    asset_data = registry.get_assets_by_path(ART_CONTENT_ROOT, recursive=True)
    for data in asset_data:
        try:
            asset = data.get_asset()
            set_pixel_import_defaults(asset)
        except Exception as error:
            log("Skipped optional texture setup for {}: {}".format(data.asset_name, error))
    unreal.EditorAssetLibrary.save_directory(ART_CONTENT_ROOT, False, True)
    log("Imported {} source images to {}".format(source_image_count, ART_CONTENT_ROOT))
    return source_image_count


def create_blueprint(name, parent_class, package_path):
    asset_path = package_path + "/" + name
    if unreal.EditorAssetLibrary.does_asset_exist(asset_path):
        log("Keeping existing Blueprint {}".format(asset_path))
        return unreal.EditorAssetLibrary.load_asset(asset_path)

    factory = unreal.BlueprintFactory()
    factory.set_editor_property("parent_class", parent_class)
    blueprint = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        name, package_path, unreal.Blueprint, factory
    )
    if not blueprint:
        log("Could not create Blueprint {}".format(asset_path))
        return None
    unreal.BlueprintEditorLibrary.compile_blueprint(blueprint)
    unreal.EditorAssetLibrary.save_loaded_asset(blueprint, False)
    return blueprint


def create_widget_blueprint(name, package_path):
    asset_path = package_path + "/" + name
    if unreal.EditorAssetLibrary.does_asset_exist(asset_path):
        log("Keeping existing Widget Blueprint {}".format(asset_path))
        return unreal.EditorAssetLibrary.load_asset(asset_path)

    factory = unreal.WidgetBlueprintFactory()
    factory.set_editor_property("parent_class", unreal.UserWidget)
    widget_class = getattr(unreal, "WidgetBlueprint", None)
    if not widget_class:
        log("WidgetBlueprint class is unavailable; skipped {}".format(asset_path))
        return None
    blueprint = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        name, package_path, widget_class, factory
    )
    if not blueprint:
        log("Could not create Widget Blueprint {}".format(asset_path))
        return None
    unreal.BlueprintEditorLibrary.compile_blueprint(blueprint)
    unreal.EditorAssetLibrary.save_loaded_asset(blueprint, False)
    return blueprint


def create_blueprint_scaffolds():
    unreal.EditorAssetLibrary.make_directory(BLUEPRINT_CONTENT_ROOT)
    class_plans = [
        ("BP_GBQ_GameInstance", unreal.GameInstance),
        ("BP_GBQ_GameMode", unreal.GameModeBase),
        ("BP_GBQ_GameState", unreal.GameStateBase),
        ("BP_GBQ_PlayerState", unreal.PlayerState),
        ("BP_GBQ_PlayerController", unreal.PlayerController),
        ("BP_GBQ_PlayerCharacter", unreal.load_class(None, "/Script/GBQuestUE5.GBQPlayerCharacter") or unreal.Character),
        ("BP_GBQ_BattleManager", unreal.Actor),
        ("BP_GBQ_GameSystems", unreal.ActorComponent),
        ("BP_GBQ_Presentation", unreal.Actor),
        ("BP_GBQ_RulesComponent", unreal.ActorComponent),
    ]
    results = []
    for name, parent_class in class_plans:
        blueprint = create_blueprint(name, parent_class, BLUEPRINT_CONTENT_ROOT)
        results.append({
            "blueprint": BLUEPRINT_CONTENT_ROOT + "/" + name,
            "parent_class": parent_class.get_name(),
            "created": blueprint is not None,
            "status": "empty_scaffold_logic_not_translated",
        })

    widget_plans = ["WBP_GBQ_BootFlow", "WBP_GBQ_WorldFlow", "WBP_GBQ_Menus"]
    for name in widget_plans:
        blueprint = create_widget_blueprint(name, BLUEPRINT_CONTENT_ROOT)
        results.append({
            "blueprint": BLUEPRINT_CONTENT_ROOT + "/" + name,
            "parent_class": "UserWidget",
            "created": blueprint is not None,
            "status": "empty_widget_scaffold_logic_not_translated",
        })
    return results


def write_manifest(root, source_files, imported_image_count, blueprints):
    payload = {
        "project": "GB-Quest",
        "repository_root": root,
        "imported_image_count": imported_image_count,
        "blueprints": blueprints,
        "source_files": source_manifest(source_files),
        "conversion_note": (
            "Files are cloned for reference and mapped to candidate Unreal destinations. "
            "JavaScript gameplay logic is not automatically converted into Blueprint nodes. "
            "Implement and validate each mapped system in the listed Blueprint assets."
        ),
    }
    with open(MANIFEST_PATH, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
    log("Wrote {}".format(MANIFEST_PATH))


def main():
    try:
        root = source_root()
        log("Repository: {}".format(root))
        source_files = copy_source_tree(root)
        image_count = import_art(root)
        blueprints = create_blueprint_scaffolds()
        write_manifest(root, source_files, image_count, blueprints)
        log("Import and Blueprint scaffolding finished. Gameplay graph conversion remains pending.")
    except Exception:
        unreal.log_error("[GBQuest Port] Script failed:\n" + traceback.format_exc())
        raise


main()
