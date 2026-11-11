#!/usr/bin/env python3
"""Install the asset pack's pixel-art actor variants as named game runtime assets.

The source pack includes dedicated transparent px/ renders for each actor category.
This script copies those source sprites into assets/ with stable game-facing names;
it does not modify the supplied pack files.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
CATEGORIES = (
    ("characters", "actor_character", 43),
    ("npcs", "actor_npc", 33),
    ("enemies", "actor_enemy", 19),
    ("monsters", "actor_monster", 24),
)


def main():
    source_root = ROOT / "assets_pack"
    runtime_root = ROOT / "assets"
    runtime_root.mkdir(parents=True, exist_ok=True)
    installed = 0
    for source_category, runtime_prefix, expected_count in CATEGORIES:
        for index in range(expected_count):
            stem = f"{source_category}_{index:03d}"
            source = source_root / source_category / "px" / f"{stem}.png"
            target = runtime_root / f"{runtime_prefix}_{index:03d}.png"
            if not source.is_file():
                raise FileNotFoundError(f"Expected pixel-art sprite is missing: {source}")
            shutil.copyfile(source, target)
            installed += 1
    print(f"Installed {installed} pixel-art actor sprites into {runtime_root}")


if __name__ == "__main__":
    main()
