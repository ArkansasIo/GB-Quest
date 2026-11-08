#!/usr/bin/env python3
"""Import a legally obtained itch.io PNG pack into GB Quest's runtime asset index.

The user must download the pack from itch.io and review its licence first.
Only PNG files are copied. Sprite sheets remain whole images; they are NOT
silently treated as single sprites. The source ZIP is not redistributed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
INDEX = ASSETS / "index.json"
MANIFEST = ASSETS / "itchio_manifest.json"
MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_DIMENSION = 4096


def category_for(path: str) -> str:
    value = path.lower()
    rules = [
        ("characters", r"character|hero|player|npc|portrait"),
        ("monsters", r"monster|creature|enemy|boss|beast|goblin|dragon"),
        ("weapons", r"weapon|sword|axe|bow|staff|spear"),
        ("armor", r"armou?r|helmet|shield|boots|glove|cape"),
        ("items", r"item|potion|loot|gem|coin|icon"),
        ("ui", r"ui|hud|panel|button|frame|cursor|slot"),
        ("terrain", r"terrain|tile|biome|grass|water|floor|wall|autotile"),
        ("effects", r"effect|vfx|spell|magic|explosion|particle"),
        ("backgrounds", r"background|parallax|scene"),
        ("buildings", r"building|house|shop|inn|tavern|interior"),
    ]
    for category, pattern in rules:
        if re.search(pattern, value):
            return category
    return "misc"


def png_dimensions(data: bytes) -> tuple[int, int] | None:
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip", type=Path, help="itch.io ZIP downloaded by the user")
    parser.add_argument("--pack", required=True, help="short stable pack slug, e.g. genxia-free-sampler")
    parser.add_argument("--source-url", required=True, help="itch.io product page URL")
    parser.add_argument("--license", required=True, help="exact licence summary verified on the product page")
    parser.add_argument("--credit", default="", help="required creator credit, if any")
    args = parser.parse_args()

    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,47}", args.pack):
        raise SystemExit("--pack must be a 2-48 character lowercase slug")
    if not args.zip.is_file():
        raise SystemExit(f"ZIP not found: {args.zip}")
    if not args.source_url.startswith("https://"):
        raise SystemExit("--source-url must be HTTPS")
    if not args.license.strip():
        raise SystemExit("--license must contain the verified licence terms")

    ASSETS.mkdir(parents=True, exist_ok=True)
    names = json.loads(INDEX.read_text(encoding="utf-8"))
    if not isinstance(names, list):
        raise SystemExit("assets/index.json must be a JSON array")
    known = set(names)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {"version": 1, "packs": []}
    pack_record = {
        "slug": args.pack,
        "source": args.source_url,
        "license": args.license.strip(),
        "credit": args.credit.strip(),
        "files": [],
        "notes": "Sprite sheets are preserved as sheets; add crop/animation metadata before assigning them to individual entities."
    }
    added = 0
    with zipfile.ZipFile(args.zip) as archive:
        for info in archive.infolist():
            member = PurePosixPath(info.filename)
            if info.is_dir() or member.is_absolute() or ".." in member.parts or member.suffix.lower() != ".png":
                continue
            if info.file_size <= 0 or info.file_size > MAX_IMAGE_BYTES:
                continue
            data = archive.read(info)
            dims = png_dimensions(data)
            if not dims or max(dims) > MAX_DIMENSION:
                continue
            digest = hashlib.sha256(data).hexdigest()
            category = category_for(info.filename)
            stem = re.sub(r"[^a-z0-9]+", "_", member.stem.lower()).strip("_")[:36] or "image"
            asset_id = f"itch_{args.pack}_{category}_{stem}_{digest[:8]}"
            if asset_id in known:
                continue
            (ASSETS / f"{asset_id}.png").write_bytes(data)
            names.append(asset_id)
            known.add(asset_id)
            pack_record["files"].append({
                "id": asset_id,
                "source_file": info.filename,
                "category": category,
                "width": dims[0],
                "height": dims[1],
                "sha256": digest,
                "review_required": dims[0] > 128 or dims[1] > 128,
            })
            added += 1

    if not added:
        raise SystemExit("No new valid PNG files found; no index or manifest changes made.")
    manifest["packs"] = [p for p in manifest.get("packs", []) if p.get("slug") != args.pack]
    manifest["packs"].append(pack_record)
    INDEX.write_text(json.dumps(sorted(names), indent=2) + "\n", encoding="utf-8")
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Imported {added} PNGs from {args.pack}; review sheets and update runtime mappings before release.")


if __name__ == "__main__":
    main()
