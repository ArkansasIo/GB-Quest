#!/usr/bin/env python3
"""Validate a generated GB-Quest HD64 6,000-asset pack.

The check is read-only. It verifies manifest/CSV agreement, category totals,
asset ID uniqueness, PNG decoding, dimensions/mode, file existence and duplicate
image content. It deliberately does not regenerate or modify any artwork.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image

EXPECTED = {
    "player_races_characters": 500,
    "classes_subclasses": 300,
    "weapons": 600,
    "armor_clothing": 600,
    "jewelry_accessories": 250,
    "monsters_creatures": 700,
    "bosses_raid_creatures": 250,
    "environments_tilesets": 700,
    "buildings_settlements": 300,
    "maps_worlds": 150,
    "dungeons_towers_raids": 250,
    "magic_visual_effects": 250,
    "items_consumables": 350,
    "mounts_pets": 150,
    "npcs_civilians": 200,
    "ui_interface": 200,
    "factions_quests_achievements": 150,
    "promotional_loading_art": 100,
}
EXPECTED_TOTAL = sum(EXPECTED.values())


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def load_json(path: Path, errors: list[str]):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(errors, f"Missing file: {path}")
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        fail(errors, f"Cannot read JSON {path}: {exc}")
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root", type=Path, default=Path("assets_hd64/gbq_6000"),
        help="generated pack root (default: assets_hd64/gbq_6000)",
    )
    parser.add_argument("--allow-partial", action="store_true",
                        help="allow subset manifests, for focused generator runs")
    parser.add_argument("--allow-duplicate-images", action="store_true",
                        help="report but do not fail on identical PNG content")
    args = parser.parse_args()

    root = args.root
    metadata = root / "metadata"
    manifest_path = metadata / "manifest.json"
    csv_path = metadata / "assets.csv"
    errors: list[str] = []
    manifest = load_json(manifest_path, errors)
    if manifest is None:
        print("\n".join(errors), file=sys.stderr)
        return 1

    records = manifest.get("assets") if isinstance(manifest, dict) else None
    if records is None and isinstance(manifest, dict):
        records = manifest.get("items")
    if not isinstance(records, list):
        fail(errors, "manifest.json must contain an 'assets' or 'items' array")
        records = []

    counts: Counter[str] = Counter()
    ids: set[str] = set()
    paths: set[str] = set()
    digests: dict[str, str] = {}
    duplicate_images: list[tuple[str, str]] = []

    for index, record in enumerate(records):
        if not isinstance(record, dict):
            fail(errors, f"Manifest entry {index} is not an object")
            continue
        asset_id = str(record.get("id", "")).strip()
        category = str(record.get("category", "")).strip()
        relative = record.get("path") or record.get("file")
        if not asset_id:
            fail(errors, f"Manifest entry {index} has no id")
            continue
        if asset_id in ids:
            fail(errors, f"Duplicate asset id: {asset_id}")
        ids.add(asset_id)
        if category not in EXPECTED:
            fail(errors, f"{asset_id}: unknown category {category!r}")
        else:
            counts[category] += 1
        if not isinstance(relative, str) or not relative:
            fail(errors, f"{asset_id}: missing path/file")
            continue
        if relative in paths:
            fail(errors, f"Duplicate asset path in manifest: {relative}")
        paths.add(relative)
        image_path = root / relative
        if not image_path.is_file():
            fail(errors, f"{asset_id}: missing image {image_path}")
            continue
        try:
            with Image.open(image_path) as image:
                image.verify()
            with Image.open(image_path) as image:
                if image.size != (64, 64):
                    fail(errors, f"{asset_id}: expected 64x64, got {image.size}")
                if image.mode != "RGBA":
                    fail(errors, f"{asset_id}: expected RGBA, got {image.mode}")
            digest = hashlib.sha256(image_path.read_bytes()).hexdigest()
            if digest in digests:
                duplicate_images.append((asset_id, digests[digest]))
            else:
                digests[digest] = asset_id
        except Exception as exc:  # Pillow exposes several decode exception types.
            fail(errors, f"{asset_id}: invalid PNG {image_path}: {exc}")

    if not args.allow_partial:
        if len(records) != EXPECTED_TOTAL:
            fail(errors, f"Expected {EXPECTED_TOTAL} manifest records, found {len(records)}")
        for category, expected in EXPECTED.items():
            actual = counts[category]
            if actual != expected:
                fail(errors, f"{category}: expected {expected}, found {actual}")
        if set(counts) != set(EXPECTED):
            fail(errors, "Manifest does not include all 18 expected categories")

    if csv_path.is_file():
        try:
            with csv_path.open(newline="", encoding="utf-8") as handle:
                rows = list(csv.DictReader(handle))
            csv_ids = [str(row.get("id", "")).strip() for row in rows]
            if len(rows) != len(records):
                fail(errors, f"assets.csv has {len(rows)} rows; manifest has {len(records)}")
            if Counter(csv_ids) != Counter(
                str(row.get("id", "")).strip() for row in records if isinstance(row, dict)
            ):
                fail(errors, "assets.csv IDs do not match manifest IDs")
        except (OSError, UnicodeError, csv.Error) as exc:
            fail(errors, f"Cannot read {csv_path}: {exc}")
    else:
        fail(errors, f"Missing file: {csv_path}")

    if duplicate_images and not args.allow_duplicate_images:
        examples = ", ".join(f"{a}={b}" for a, b in duplicate_images[:8])
        fail(errors, f"{len(duplicate_images)} duplicate PNG contents found ({examples})")

    if errors:
        print("HD64 asset validation FAILED:")
        print("\n".join(f"- {message}" for message in errors))
        return 1

    print(
        f"HD64 asset validation passed: {len(records)} unique assets, "
        f"{len(counts)} categories, 64x64 RGBA; no duplicate image contents."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
