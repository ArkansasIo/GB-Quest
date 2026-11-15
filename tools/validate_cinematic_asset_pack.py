#!/usr/bin/env python3
"""Validate the cinematic 6,000-asset production drop before Unreal import."""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
SPEC=ROOT/"data/visuals/cinematic_asset_budget.json"
def digest(p):
 h=hashlib.sha256()
 with p.open("rb") as f:
  for b in iter(lambda:f.read(1048576),b""): h.update(b)
 return h.hexdigest()
def main():
 ap=argparse.ArgumentParser()
 ap.add_argument("--source",type=Path,default=ROOT/"Content/GBQuest/ArtSource")
 ap.add_argument("--report",type=Path,default=ROOT/"build/reports/cinematic_asset_validation.json")
 ap.add_argument("--min-resolution",type=int,default=2048)
 a=ap.parse_args(); spec=json.loads(SPEC.read_text()); rows=[]; errors=[]; seen={}
 for c in spec["categories"]:
  folder=a.source/c["id"]; files=sorted(p for p in folder.rglob("*") if p.is_file()) if folder.exists() else []
  imgs=[p for p in files if p.suffix.lower() in {".png",".jpg",".jpeg",".tif",".tiff",".exr"}]
  models=[p for p in files if p.suffix.lower() in {".fbx",".glb",".gltf",".uasset"}]
  for p in imgs:
   sha=digest(p)
   if sha in seen: errors.append(f"Duplicate image bytes: {p} duplicates {seen[sha]}")
   seen[sha]=p
   try:
    with Image.open(p) as im:
     if min(im.size)<a.min_resolution: errors.append(f"Below {a.min_resolution}px: {p} ({im.width}x{im.height})")
   except Exception as e: errors.append(f"Unreadable image {p}: {e}")
  found=len(imgs)+len(models); rows.append({"category":c["id"],"target":c["count"],"found":found,"images":len(imgs),"models":len(models)})
  if found<c["count"]: errors.append(f"{c['id']}: expected {c['count']}, found {found}")
 report={"target_assets":spec["total_assets"],"found_assets":sum(x["found"] for x in rows),"min_resolution":a.min_resolution,"categories":rows,"valid":not errors,"errors":errors,"legacy_assets_deleted":False}
 a.report.parent.mkdir(parents=True,exist_ok=True); a.report.write_text(json.dumps(report,indent=2)); print(json.dumps(report,indent=2))
 return 0 if not errors else 1
if __name__=="__main__": raise SystemExit(main())
