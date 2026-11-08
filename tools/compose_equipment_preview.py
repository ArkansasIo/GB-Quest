#!/usr/bin/env python3
"""Composite a character animation frame with selected equipment overlay layers.

Loadout JSON example:
{"head":"iron_helm","chest":"iron_plate","main_hand":"iron_sword","off_hand":"iron_shield"}
"""
import argparse
import json
from pathlib import Path
from PIL import Image

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", type=Path, required=True, help="Base character frame PNG")
    ap.add_argument("--manifest", type=Path, default=Path("assets_hd64/equipment/equipment_manifest.json"))
    ap.add_argument("--loadout", type=Path, required=True, help="JSON object mapping slot to equipment item ID")
    ap.add_argument("--rank", choices=["F","E","D","C","B","A","S","SS","SSS"], default="F")
    ap.add_argument("--direction", choices=["S","SW","W","NW","N","NE","E","SE"], default="S")
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    loadout = json.loads(args.loadout.read_text(encoding="utf-8"))
    if not isinstance(loadout, dict):
        raise SystemExit("Loadout must be a JSON object mapping equipment slots to item IDs.")
    base = Image.open(args.base).convert("RGBA")
    expected = (manifest["canvas"]["width"], manifest["canvas"]["height"])
    if base.size != expected:
        raise SystemExit(f"Base frame is {base.size}; manifest canvas requires {expected}.")

    lookup = {(entry["slot"], entry["id"], entry["rank"], entry["direction"]): entry
              for entry in manifest["items"]}
    unknown_slots = set(loadout) - set(manifest["slots"])
    if unknown_slots:
        raise SystemExit("Unknown equipment slots: " + ", ".join(sorted(unknown_slots)))

    result = base.copy()
    applied = []
    ordered_slots = sorted(loadout, key=lambda slot: manifest["slots"][slot]["draw_order"])
    for slot in ordered_slots:
        item_id = loadout[slot]
        if item_id is None:
            continue
        key = (slot, item_id, args.rank, args.direction)
        entry = lookup.get(key)
        if entry is None:
            raise SystemExit(f"No overlay found for {slot}/{item_id}/{args.rank}/{args.direction}.")
        overlay_path = args.manifest.parent / entry["path"]
        if not overlay_path.is_file():
            raise SystemExit(f"Overlay PNG is missing: {overlay_path}")
        overlay = Image.open(overlay_path).convert("RGBA")
        if overlay.size != expected:
            raise SystemExit(f"Overlay {overlay_path} has size {overlay.size}; expected {expected}.")
        offset = entry.get("offset", [0, 0])
        result.alpha_composite(overlay, (int(offset[0]), int(offset[1])))
        applied.append({"slot": slot, "item": item_id, "path": entry["path"]})

    args.output.parent.mkdir(parents=True, exist_ok=True)
    result.save(args.output, optimize=True)
    report = {"base": str(args.base), "output": str(args.output), "rank": args.rank,
              "direction": args.direction, "canvas": list(expected), "applied": applied}
    args.output.with_suffix(".json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Composited {len(applied)} equipment layers -> {args.output}")

if __name__ == "__main__":
    main()
