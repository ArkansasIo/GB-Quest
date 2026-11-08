#!/usr/bin/env python3
"""Build compact 10x10 HD64 atlas pages for all 6,000 generated source PNGs."""
from __future__ import annotations
import argparse, json, math
from collections import defaultdict
from pathlib import Path
from PIL import Image

PAGE_SIZE = 100
COLUMNS = 10
CELL = 64
EXPECTED = 6000

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("assets_hd64/gbq_6000"))
    parser.add_argument("--allow-partial", action="store_true")
    args = parser.parse_args()
    root = args.root
    manifest_path = root / "metadata" / "asset_manifest.json"
    if not manifest_path.is_file():
        parser.error(f"missing asset manifest: {manifest_path}; generate the pack first")
    records = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(records, list) or not records:
        parser.error("asset manifest must be a non-empty JSON array")
    if not args.allow_partial and len(records) != EXPECTED:
        parser.error(f"expected {EXPECTED} records, found {len(records)} (use --allow-partial only for development)")
    by_category = defaultdict(list)
    seen = set()
    for row in records:
        aid = str(row.get("asset_id", "")).strip()
        category = str(row.get("category", "")).strip()
        rel = row.get("path")
        if not aid or aid in seen:
            parser.error(f"missing or duplicate asset id: {aid!r}")
        seen.add(aid)
        if not category or not isinstance(rel, str):
            parser.error(f"{aid}: category/path missing")
        source = root / rel
        if not source.is_file():
            parser.error(f"{aid}: missing source image {source}")
        by_category[category].append((row, source))
    atlas_dir = root / "atlases"
    atlas_dir.mkdir(parents=True, exist_ok=True)
    index = {}
    atlas_files = []
    for category in sorted(by_category):
        entries = by_category[category]
        for start in range(0, len(entries), PAGE_SIZE):
            page = start // PAGE_SIZE
            chunk = entries[start:start + PAGE_SIZE]
            rows = math.ceil(len(chunk) / COLUMNS)
            sheet = Image.new("RGBA", (COLUMNS * CELL, rows * CELL), (0, 0, 0, 0))
            filename = f"{category}_{page:03d}.png"
            for offset, (record, source) in enumerate(chunk):
                with Image.open(source) as opened:
                    image = opened.convert("RGBA")
                    if image.size != (CELL, CELL):
                        parser.error(f"{record['asset_id']}: expected {CELL}x{CELL}, got {image.size}")
                x, y = (offset % COLUMNS) * CELL, (offset // COLUMNS) * CELL
                sheet.alpha_composite(image, (x, y))
                index[record["asset_id"]] = {
                    "category": category,
                    "atlas": f"atlases/{filename}",
                    "rect": [x, y, CELL, CELL],
                    "source": str(record["path"]).replace("\\", "/")
                }
            sheet.save(atlas_dir / filename, optimize=True)
            atlas_files.append({"category": category, "page": page, "file": f"atlases/{filename}", "assets": len(chunk), "width": sheet.width, "height": sheet.height})
            print(f"{filename}: {len(chunk)} sprites", flush=True)
    result = {
        "schemaVersion": 1,
        "title": "GB Quest HD64 6,000 Asset Atlas Index",
        "assetCount": len(index),
        "pageSize": PAGE_SIZE,
        "columns": COLUMNS,
        "cellSize": [CELL, CELL],
        "atlases": atlas_files,
        "assets": index
    }
    target = root / "metadata" / "atlas_index.json"
    target.write_text(json.dumps(result, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Indexed {len(index):,} sprites into {len(atlas_files)} atlas pages: {target}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
