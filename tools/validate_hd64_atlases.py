#!/usr/bin/env python3
"""Validate HD64 atlas manifests against their packed PNG pages."""
import argparse
import json
import struct
import sys
from pathlib import Path


def png_size(path):
    with path.open("rb") as stream:
        header = stream.read(24)
    if len(header) != 24 or header[:8] != b"\\x89PNG\\r\\n\\x1a\\n" or header[12:16] != b"IHDR":
        raise ValueError(f"not a valid PNG header: {path}")
    return struct.unpack(">II", header[16:24])


def validate_atlases(root):
    root = Path(root)
    errors = []
    total = 0
    summaries = []
    manifests = sorted(root.glob("*.json"))
    if not manifests:
        return 0, [f"No atlas manifests found in {root}"], []

    for manifest_path in manifests:
        try:
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{manifest_path.name}: cannot read JSON ({exc})")
            continue
        if not isinstance(data, dict) or not data:
            errors.append(f"{manifest_path.name}: expected a non-empty object of sprite rectangles")
            continue

        pages = {}
        checked = 0
        for name, rect in data.items():
            if not isinstance(rect, list) or len(rect) != 5:
                errors.append(f"{manifest_path.name}:{name}: expected [page, x, y, width, height]")
                continue
            page, x, y, width, height = rect
            if any(type(v) is not int for v in rect):
                errors.append(f"{manifest_path.name}:{name}: rectangle values must be integers")
                continue
            if page < 0 or x < 0 or y < 0 or width <= 0 or height <= 0:
                errors.append(f"{manifest_path.name}:{name}: invalid negative/zero rectangle values {rect}")
                continue

            if page not in pages:
                image_path = root / f"{manifest_path.stem}_{page}.png"
                if not image_path.is_file():
                    errors.append(f"{manifest_path.name}:{name}: missing atlas page {image_path.name}")
                    pages[page] = None
                else:
                    try:
                        pages[page] = png_size(image_path)
                    except (OSError, ValueError, struct.error) as exc:
                        errors.append(f"{manifest_path.name}: {exc}")
                        pages[page] = None
            dimensions = pages[page]
            if dimensions is None:
                continue
            image_width, image_height = dimensions
            if x + width > image_width or y + height > image_height:
                errors.append(
                    f"{manifest_path.name}:{name}: rectangle {rect[1:]} exceeds "
                    f"{image_width}x{image_height} page {page}"
                )
                continue
            checked += 1
        total += checked
        summaries.append((manifest_path.name, checked, len(pages)))
    return total, errors, summaries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("assets_hd64"))
    args = parser.parse_args()
    total, errors, summaries = validate_atlases(args.root)
    for name, count, pages in summaries:
        print(f"{name}: {count} sprites validated across {pages} referenced page(s)")
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"HD64 atlas validation failed: {len(errors)} error(s)", file=sys.stderr)
        return 1
    print(f"HD64 atlas validation passed: {total} sprite rectangles across {len(summaries)} manifests")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
