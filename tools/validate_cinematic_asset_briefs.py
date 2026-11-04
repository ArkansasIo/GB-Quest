#!/usr/bin/env python3
"""Validate the generated 6,000-entry cinematic asset brief CSV.

This checks the production queue, not rendered art. It deliberately uses only
the Python standard library so CI can run it without image-processing packages.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BUDGET = ROOT / "data/visuals/cinematic_asset_budget.json"
DEFAULT_CSV = ROOT / "data/visuals/cinematic_asset_prompts.csv"
REQUIRED = {
    "asset_id", "category", "sequence", "variation_seed", "asset_name",
    "asset_type", "target_engine", "resolution", "maps", "prompt",
    "negative_prompt", "source_filename", "status",
}
ASSET_ID = re.compile(r"^GBQ-CIN-(\\d{4})$")


def validate(budget_path: Path, csv_path: Path) -> dict:
    errors: list[str] = []
    budget = json.loads(budget_path.read_text(encoding="utf-8"))
    expected_total = int(budget["total_assets"])
    category_targets = {item["id"]: int(item["count"]) for item in budget["categories"]}
    if sum(category_targets.values()) != expected_total:
        errors.append(
            f"Budget mismatch: category total {sum(category_targets.values())}, "
            f"declared total {expected_total}"
        )

    rows: list[dict[str, str]] = []
    if not csv_path.is_file():
        errors.append(f"Brief CSV does not exist: {csv_path}")
    else:
        with csv_path.open("r", newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            headers = set(reader.fieldnames or [])
            missing = sorted(REQUIRED - headers)
            if missing:
                errors.append("Missing CSV columns: " + ", ".join(missing))
            rows = list(reader)

    if len(rows) != expected_total:
        errors.append(f"Expected {expected_total} briefs; found {len(rows)}")

    category_counts = Counter(row.get("category", "") for row in rows)
    for category, target in category_targets.items():
        actual = category_counts[category]
        if actual != target:
            errors.append(f"{category}: expected {target} briefs; found {actual}")
    unknown_categories = sorted(set(category_counts) - set(category_targets))
    if unknown_categories:
        errors.append("Unknown categories: " + ", ".join(unknown_categories))

    ids: list[str] = []
    seeds: list[str] = []
    filenames: list[str] = []
    for index, row in enumerate(rows, start=1):
        asset_id = row.get("asset_id", "").strip()
        match = ASSET_ID.fullmatch(asset_id)
        if not match:
            errors.append(f"Row {index}: invalid asset_id {asset_id!r}")
        else:
            ids.append(asset_id)
            if int(match.group(1)) != index:
                errors.append(f"Row {index}: expected GBQ-CIN-{index:04d}, got {asset_id}")

        seed = row.get("variation_seed", "").strip()
        if not seed.isdigit() or int(seed) < 1 or int(seed) > 2**31 - 1:
            errors.append(f"Row {index} ({asset_id}): invalid variation_seed {seed!r}")
        else:
            seeds.append(seed)

        filename = row.get("source_filename", "").strip()
        if not filename:
            errors.append(f"Row {index} ({asset_id}): missing source_filename")
        else:
            filenames.append(filename)

        for field in ("asset_name", "prompt", "negative_prompt", "target_engine", "resolution", "maps"):
            if not row.get(field, "").strip():
                errors.append(f"Row {index} ({asset_id}): missing {field}")

        if row.get("status") != "brief_ready_source_art_not_generated":
            errors.append(f"Row {index} ({asset_id}): unexpected status {row.get('status')!r}")

    for label, values in (("asset_id", ids), ("variation_seed", seeds), ("source_filename", filenames)):
        duplicates = [value for value, count in Counter(values).items() if count > 1]
        if duplicates:
            errors.append(f"Duplicate {label} values: {', '.join(duplicates[:10])}")

    return {
        "valid": not errors,
        "expected_briefs": expected_total,
        "actual_briefs": len(rows),
        "category_counts": dict(sorted(category_counts.items())),
        "unique_asset_ids": len(set(ids)),
        "unique_variation_seeds": len(set(seeds)),
        "unique_source_filenames": len(set(filenames)),
        "rendered_assets_verified": False,
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--budget", type=Path, default=DEFAULT_BUDGET)
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    result = validate(args.budget, args.csv)
    output = json.dumps(result, indent=2)
    print(output)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(output + "\\n", encoding="utf-8")
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
