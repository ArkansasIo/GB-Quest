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
from collections import Counter
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
    manifest_path = metadata / "asset_manifest.json"
    csv_path = metadata / "asset_manifest.csv"
    errors: list[str] = []
    manifest = load_json(manifest_path, errors)
    if manifest is None:
        print("\n".join(errors), file=sys.stderr)
        return 1

    records = manifest if isinstance(manifest, list) else None
    if not isinstance(records, list):
        fail(errors, "asset_manifest.json must contain a JSON array of records")
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
        asset_id = str(record.get("asset_id", record.get("id", ""))).strip()
        category = str(record.get("category", "")).strip()
        relative = record.get("path") or record.get("file") or record.get("filename")
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
        relative_path = Path(relative)
        if relative_path.is_absolute() or ".." in relative_path.parts:
            fail(errors, f"{asset_id}: unsafe image path {relative!r}")
            continue
        if relative in paths:
            fail(errors, f"Duplicate asset path in manifest: {relative}")
        paths.add(relative)
        image_path = root / relative_path
        if not image_path.is_file() and (root / "assets" / relative_path).is_file():
            image_path = root / "assets" / relative_path
        try:
            # Resolve symlinks before opening: a manifest must not escape the pack root.
            resolved_image = image_path.resolve(strict=True)
            resolved_root = root.resolve(strict=True)
            if not resolved_image.is_relative_to(resolved_root):
                fail(errors, f"{asset_id}: image path escapes pack root: {relative!r}")
                continue
        except FileNotFoundError:
            fail(errors, f"{asset_id}: missing image {image_path}")
            continue
        except OSError as exc:
            fail(errors, f"{asset_id}: cannot resolve image {image_path}: {exc}")
            continue
        try:
            with Image.open(resolved_image) as image:
                if image.format != "PNG":
                    fail(errors, f"{asset_id}: expected PNG format, got {image.format}")
                image.verify()
            with Image.open(resolved_image) as image:
                if image.size != (64, 64):
                    fail(errors, f"{asset_id}: expected 64x64, got {image.size}")
                if image.mode != "RGBA":
                    fail(errors, f"{asset_id}: expected RGBA, got {image.mode}")
                # Hash canonical decoded pixels, not the compressed file bytes. This
                # catches visually identical images saved with different PNG encoders.
                image.load()
                digest = hashlib.sha256(image.convert("RGBA").tobytes()).hexdigest()
            if digest in digests:
                duplicate_images.append((asset_id, digests[digest]))
            else:
                digests[digest] = asset_id
        except Exception as exc:  # Pillow exposes several decode exception types.
            fail(errors, f"{asset_id}: invalid PNG {resolved_image}: {exc}")

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
                reader = csv.DictReader(handle)
                csv_fields = set(reader.fieldnames or [])
                rows = list(reader)
            required_fields = {field for record in records if isinstance(record, dict) for field in record}
            missing_fields = required_fields - csv_fields
            if missing_fields:
                fail(errors, "asset_manifest.csv is missing JSON fields: " + ", ".join(sorted(missing_fields)))
            csv_ids = [str(row.get("asset_id", row.get("id", ""))).strip() for row in rows]
            if len(rows) != len(records):
                fail(errors, f"asset_manifest.csv has {len(rows)} rows; manifest has {len(records)}")
            if Counter(csv_ids) != Counter(
                str(row.get("asset_id", row.get("id", ""))).strip() for row in records if isinstance(row, dict)
            ):
                fail(errors, "asset_manifest.csv IDs do not match JSON manifest IDs")
            # Compare every shared column, not just IDs, so stale paths, dimensions,
            # categories and other metadata cannot silently drift between manifests.
            for index, (csv_row, json_row) in enumerate(zip(rows, records)):
                if not isinstance(json_row, dict):
                    continue
                for field, csv_value in csv_row.items():
                    if field not in json_row:
                        fail(errors, f"CSV row {index + 2}: unexpected column {field!r}")
                        continue
                    expected_value = "" if json_row[field] is None else str(json_row[field])
                    if csv_value != expected_value:
                        fail(errors, f"CSV row {index + 2} {field}: {csv_value!r} != JSON {expected_value!r}")
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
        f"{len(counts)} categories, 64x64 RGBA; no duplicate decoded images."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
