#!/usr/bin/env python3
"""Extract reviewable icon cells from GB-Quest composite art panels.

Usage:
  python tools/extract_gothic_sprites.py --source-dir assets_gothic/staging --output-dir assets_gothic/sprites

This first pass extracts regular skill and equipment icon grids only. It does
not fabricate transparency or animation frames; review and clean the output
before connecting individual icons to gameplay data.
"""
from __future__ import annotations
import argparse, json
from pathlib import Path
from PIL import Image

PROFILES = {
    "skills": {"source": "skills-abilities-atlas.png", "cols": 8, "rows": 3,
               "cell": (50, 61), "inner": (4, 10, 46, 58)},
    "equipment": {"source": "weapons-armor-atlas.png", "cols": 8, "rows": 4,
                  "cell": (50, 53), "inner": (3, 3, 47, 50)},
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    manifest = {"pack": "GB-Quest Gothic first-pass icon slices", "version": "1.0.0",
                "quality": "review-required", "groups": {}}
    for group, profile in PROFILES.items():
        source = args.source_dir / profile["source"]
        if not source.exists():
            raise FileNotFoundError(source)
        image = Image.open(source).convert("RGBA")
        cell_w, cell_h = profile["cell"]
        left, top, right, bottom = profile["inner"]
        records = []
        for row in range(profile["rows"]):
            for col in range(profile["cols"]):
                x, y = col * cell_w, row * cell_h
                crop = (x + left, y + top, min(x + right, image.width),
                        min(y + bottom, image.height))
                if crop[2] <= crop[0] or crop[3] <= crop[1]:
                    continue
                filename = f"{group}_{row * profile['cols'] + col:03d}.png"
                image.crop(crop).save(args.output_dir / filename, optimize=True)
                records.append({"file": filename, "row": row, "column": col,
                                "source": profile["source"], "crop": list(crop),
                                "width": crop[2] - crop[0], "height": crop[3] - crop[1]})
        manifest["groups"][group] = records
    manifest["totalSprites"] = sum(map(len, manifest["groups"].values()))
    (args.output_dir / "sprite-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {manifest['totalSprites']} icon cells into {args.output_dir}")

if __name__ == "__main__":
    main()
