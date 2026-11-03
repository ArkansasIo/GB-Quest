#!/usr/bin/env python3
"""Validate catalog-to-sprite appearance aliases without touching gameplay item data."""
import argparse
import json
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", type=Path, default=Path("src/mmorpg/data/equipment.json"))
    ap.add_argument("--mapping", type=Path, default=Path("data/visuals/equipment-catalog-visual-map.json"))
    ap.add_argument("--manifest", type=Path, default=Path("assets_hd64/equipment/equipment_manifest.json"))
    ap.add_argument("--rank", choices=["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"], default="F")
    args = ap.parse_args()
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    mapping = json.loads(args.mapping.read_text(encoding="utf-8"))
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    catalog_by_id = {}
    for section in ("weapons", "armor"):
        for item in catalog.get(section, []):
            if item.get("id") in catalog_by_id:
                raise SystemExit(f"Duplicate catalog ID: {item['id']}")
            catalog_by_id[item["id"]] = (section, item)
    layer_lookup = {(x.get("slot"), x.get("id"), x.get("rank"), x.get("direction")): x
                    for x in manifest.get("items", [])}
    errors = []
    seen = set()
    directions = manifest.get("directions", [])
    for record in mapping.get("records", []):
        item_id = record.get("catalogId")
        if item_id in seen:
            errors.append(f"Duplicate visual mapping: {item_id}")
        seen.add(item_id)
        source = catalog_by_id.get(item_id)
        if source is None:
            errors.append(f"Unknown catalog item ID: {item_id}")
            continue
        section, item = source
        if section != record.get("catalogSection"):
            errors.append(f"{item_id}: section mismatch ({section})")
        slot, visual_id = record.get("slot"), record.get("visualItemId")
        if slot not in manifest.get("slots", {}):
            errors.append(f"{item_id}: unknown visual slot {slot}")
            continue
        for direction in directions:
            key = (slot, visual_id, args.rank, direction)
            layer = layer_lookup.get(key)
            if layer is None:
                errors.append(f"{item_id}: missing layer {slot}/{visual_id}/{args.rank}/{direction}")
            elif not (args.manifest.parent / layer["path"]).is_file():
                errors.append(f"{item_id}: missing PNG {layer['path']}")
    expected = len(catalog.get("weapons", [])) + len(catalog.get("armor", []))
    if len(mapping.get("records", [])) != expected:
        errors.append(f"Mapping coverage mismatch: expected {expected}, got {len(mapping.get('records', []))}")
    if errors:
        raise SystemExit("Equipment visual mapping validation failed:\n- " + "\n- ".join(errors))
    print(f"Validated {len(seen)} catalog item aliases at rank {args.rank} across {len(directions)} directions.")

if __name__ == "__main__":
    main()
