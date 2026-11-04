"""Unreal Engine 5.7 Editor Python importer for staged GB-Quest cinematic assets.

Run from the Unreal Editor Python console or an Editor Utility workflow:
    py "D:/GB-Quest/Tools/Unreal/import_cinematic_assets.py"

Expected layout:
    Content/GBQuest/ArtSource/<category>/<asset_id>.(png|tif|tiff|fbx|glb)
The script imports only files that exist and never deletes or overwrites legacy assets.
"""
import csv
import os
import unreal

PROJECT_ROOT = os.path.abspath(os.path.join(unreal.Paths.project_dir(), ".."))
SOURCE_ROOT = os.path.join(PROJECT_ROOT, "Content", "GBQuest", "ArtSource")
DEST_ROOT = "/Game/GBQuest/Cinematic"
MANIFEST = os.path.join(PROJECT_ROOT, "data", "visuals", "cinematic_asset_prompts.csv")
IMAGE_EXTS = {".png", ".tif", ".tiff", ".jpg", ".jpeg", ".exr"}
MODEL_EXTS = {".fbx", ".glb", ".gltf"}

def import_one(source_path, destination):
    task = unreal.AssetImportTask()
    task.filename = source_path
    task.destination_path = destination
    task.automated = True
    task.replace_existing = False
    task.save = True
    task.factory = None
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    return list(task.imported_object_paths or [])

def main():
    if not os.path.isfile(MANIFEST):
        raise RuntimeError("Missing cinematic asset prompt manifest: " + MANIFEST)
    imported, missing, failed = [], [], []
    with open(MANIFEST, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            category = row["category"]
            asset_id = row["asset_id"]
            folder = os.path.join(SOURCE_ROOT, category)
            candidates = [os.path.join(folder, asset_id + ext) for ext in sorted(IMAGE_EXTS | MODEL_EXTS)]
            source = next((p for p in candidates if os.path.isfile(p)), None)
            if not source:
                missing.append(asset_id)
                continue
            destination = DEST_ROOT + "/" + category
            try:
                paths = import_one(source, destination)
                if paths:
                    imported.extend(paths)
                else:
                    failed.append({"asset_id": asset_id, "source": source, "reason": "Importer returned no assets"})
            except Exception as exc:
                failed.append({"asset_id": asset_id, "source": source, "reason": str(exc)})
    report = {"expected": 6000, "imported": len(imported), "missing_source": len(missing),
              "failed": len(failed), "legacy_assets_deleted": 0,
              "imported_paths": imported, "missing_asset_ids": missing, "errors": failed}
    report_path = os.path.join(PROJECT_ROOT, "Saved", "GBQuestCinematicImportReport.json")
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    import json
    with open(report_path, "w", encoding="utf-8") as out:
        json.dump(report, out, indent=2)
    unreal.log("GB-Quest cinematic import complete: " + json.dumps({k: report[k] for k in ("expected","imported","missing_source","failed")}))
    return report

if __name__ == "__main__":
    main()
