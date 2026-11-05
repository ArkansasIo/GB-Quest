#!/usr/bin/env python3
"""Validate a generated GB-Quest 6,000-asset pack without modifying it.

Usage:
  python tools/audit_pack6000.py
  python tools/audit_pack6000.py --root assets_hd64/gbq_6000 --json-out audit.json
  python tools/audit_pack6000.py --strict-duplicates
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image, UnidentifiedImageError

EXPECTED_TOTAL = 6000
MANIFEST = Path("metadata/asset_manifest.json")
SUMMARY = Path("metadata/category_summary.json")
ASSET_ID = re.compile(r"^GBQ-(\d{4})$")


def audit(root: Path, strict_duplicates: bool = False, expected_total: int = EXPECTED_TOTAL) -> dict:
    root = root.resolve()
    errors: list[str] = []
    warnings: list[str] = []
    try:
        entries = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
        categories = json.loads((root / SUMMARY).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {"ok": False, "errors": [f"Unable to read pack manifests: {exc}"], "warnings": [],
                "expected_assets": expected_total, "manifest_assets": 0, "checked_images": 0,
                "category_counts": {}, "duplicate_groups": 0}

    if not isinstance(entries, list):
        return {"ok": False, "errors": ["Asset manifest must be a JSON array."], "warnings": [],
                "expected_assets": expected_total, "manifest_assets": 0, "checked_images": 0,
                "category_counts": {}, "duplicate_groups": 0}
    if not isinstance(categories, list):
        errors.append("Category summary must be a JSON array.")
        categories = []

    expected_by_category: dict[str, int] = {}
    for row in categories:
        if not isinstance(row, dict) or not isinstance(row.get("category"), str) or not isinstance(row.get("count"), int):
            errors.append(f"Invalid category summary row: {row!r}")
            continue
        name, count = row["category"], row["count"]
        if name in expected_by_category:
            errors.append(f"Duplicate category in summary: {name}")
        elif count < 0:
            errors.append(f"Negative expected count for category: {name}")
        else:
            expected_by_category[name] = count

    category_total = sum(expected_by_category.values())
    if category_total != expected_total:
        errors.append(f"Category summary totals {category_total}, expected {expected_total}.")
    if len(entries) != expected_total:
        errors.append(f"Manifest contains {len(entries)} records, expected {expected_total}.")

    ids: set[str] = set()
    category_indices: set[tuple[str, int]] = set()
    actual_by_category: Counter[str] = Counter()
    hashes: dict[str, list[str]] = defaultdict(list)
    checked = 0

    for index, item in enumerate(entries):
        if not isinstance(item, dict):
            errors.append(f"Manifest row {index} is not an object.")
            continue
        aid = item.get("asset_id")
        match = ASSET_ID.fullmatch(aid) if isinstance(aid, str) else None
        if not match:
            errors.append(f"Row {index}: invalid asset_id {aid!r}.")
        elif aid in ids:
            errors.append(f"Duplicate asset_id: {aid}.")
        else:
            ids.add(aid)
            if int(match.group(1)) != index + 1:
                errors.append(f"Row {index}: expected sequential asset ID GBQ-{index + 1:04d}, got {aid}.")

        category = item.get("category")
        category_index = item.get("category_index")
        if not isinstance(category, str) or category not in expected_by_category:
            errors.append(f"Row {index} ({aid}): unknown category {category!r}.")
            category = str(category)
        actual_by_category[category] += 1
        if not isinstance(category_index, int) or category_index < 1:
            errors.append(f"Row {index} ({aid}): invalid category_index.")
        else:
            key = (category, category_index)
            if key in category_indices:
                errors.append(f"Duplicate category/index pair: {category}/{category_index}.")
            category_indices.add(key)

        rel = item.get("path")
        if not isinstance(rel, str):
            errors.append(f"Row {index} ({aid}): missing asset path.")
            continue
        candidate = (root / rel).resolve()
        if root not in candidate.parents:
            errors.append(f"Row {index} ({aid}): path escapes pack root: {rel!r}.")
            continue
        if not candidate.is_file():
            errors.append(f"Row {index} ({aid}): missing file {rel}.")
            continue
        try:
            raw = candidate.read_bytes()
            with Image.open(candidate) as image:
                image.verify()
            with Image.open(candidate) as image:
                if image.format != "PNG":
                    errors.append(f"{rel}: expected PNG, got {image.format}.")
                if image.size != (64, 64):
                    errors.append(f"{rel}: expected 64x64, got {image.width}x{image.height}.")
                if image.mode != "RGBA":
                    errors.append(f"{rel}: expected RGBA, got {image.mode}.")
            hashes[hashlib.sha256(raw).hexdigest()].append(rel)
            checked += 1
        except (OSError, UnidentifiedImageError) as exc:
            errors.append(f"{rel}: unreadable image ({exc}).")

    for category, expected in expected_by_category.items():
        actual = actual_by_category[category]
        if actual != expected:
            errors.append(f"Category {category}: manifest has {actual}, expected {expected}.")
    for category in sorted(set(actual_by_category) - set(expected_by_category)):
        errors.append(f"Unexpected category in manifest: {category}.")

    duplicate_groups = [paths for paths in hashes.values() if len(paths) > 1]
    for paths in duplicate_groups:
        message = f"Identical image content ({len(paths)} files): {', '.join(paths[:8])}"
        (errors if strict_duplicates else warnings).append(message)

    return {
        "ok": not errors,
        "expected_assets": expected_total,
        "manifest_assets": len(entries),
        "checked_images": checked,
        "category_counts": dict(sorted(actual_by_category.items())),
        "duplicate_groups": len(duplicate_groups),
        "errors": errors,
        "warnings": warnings,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("assets_hd64/gbq_6000"),
                        help="Generated pack root (default: assets_hd64/gbq_6000)")
    parser.add_argument("--json-out", type=Path, help="Optional path for a machine-readable report")
    parser.add_argument("--strict-duplicates", action="store_true",
                        help="Treat byte-identical PNGs as errors instead of warnings")
    args = parser.parse_args()
    report = audit(args.root, args.strict_duplicates)
    rendered = json.dumps(report, indent=2)
    print(rendered)
    if args.json_out:
        args.json_out.write_text(rendered + "\n", encoding="utf-8")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
