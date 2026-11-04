#!/usr/bin/env python3
"""Generate configurable class/rank prototype sprite sets from the shared renderer.

The current silhouettes are warrior-derived integration placeholders. Archetype and
rank palettes distinguish variants, but do not imply finished class-specific designs.
"""
import argparse
import json
from pathlib import Path

import generate_warrior_f_sprite as renderer

ARCHETYPES = ["warrior", "mage", "ranger", "rogue", "cleric", "summoner"]
RANKS = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"]
DIRECTIONS = renderer.DIRECTIONS
ANIMATIONS = list(renderer.ANIMS)

# Distinct base palettes; shared body geometry remains a prototype silhouette.
PALETTES = {
    "warrior": {"cloth": (74, 91, 125, 255), "cloth_hi": (111, 135, 174, 255), "steel": (112,132,151,255)},
    "mage": {"cloth": (72, 55, 126, 255), "cloth_hi": (132, 111, 190, 255), "steel": (105, 116, 158, 255)},
    "ranger": {"cloth": (55, 105, 77, 255), "cloth_hi": (105, 153, 104, 255), "steel": (111, 128, 111, 255)},
    "rogue": {"cloth": (54, 61, 76, 255), "cloth_hi": (91, 99, 119, 255), "steel": (103, 110, 126, 255)},
    "cleric": {"cloth": (135, 128, 91, 255), "cloth_hi": (190, 177, 119, 255), "steel": (155, 157, 151, 255)},
    "summoner": {"cloth": (91, 55, 111, 255), "cloth_hi": (145, 91, 164, 255), "steel": (126, 102, 143, 255)},
}
RANK_GOLD = {
    "F": (150, 150, 150, 255), "E": (125, 165, 190, 255),
    "D": (80, 155, 205, 255), "C": (105, 130, 220, 255),
    "B": (160, 105, 210, 255), "A": (220, 165, 70, 255),
    "S": (225, 105, 85, 255), "SS": (235, 165, 95, 255), "SSS": (245, 220, 130, 255),
}

def render_variant(archetype, rank, direction, animation, frame, count, size):
    original = renderer.C.copy()
    try:
        renderer.C.update(PALETTES[archetype])
        renderer.C["gold"] = RANK_GOLD[rank]
        # Higher ranks progressively brighten the metal as a readable placeholder cue.
        boost = RANKS.index(rank)
        base = PALETTES[archetype]["steel"]
        renderer.C["steel_hi"] = tuple(min(255, c + boost * 7) for c in base[:3]) + (255,)
        return renderer.render(direction, animation, frame, count, size)
    finally:
        renderer.C.clear()
        renderer.C.update(original)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=Path, default=Path("assets_hd64/animations/frames"))
    ap.add_argument("--size", type=int, choices=[64, 128, 256, 512], default=128)
    ap.add_argument("--archetypes", nargs="+", choices=ARCHETYPES, default=["warrior"])
    ap.add_argument("--ranks", nargs="+", choices=RANKS, default=["F"])
    ap.add_argument("--directions", nargs="*", choices=DIRECTIONS, default=DIRECTIONS)
    ap.add_argument("--animations", nargs="*", choices=ANIMATIONS, default=ANIMATIONS)
    args = ap.parse_args()
    total = 0
    reports = []
    for archetype in args.archetypes:
        for rank in args.ranks:
            count_for_set = 0
            for direction in args.directions:
                for animation in args.animations:
                    frame_count, loop = renderer.ANIMS[animation]
                    folder = args.output / archetype / rank / direction / animation
                    folder.mkdir(parents=True, exist_ok=True)
                    for frame in range(frame_count):
                        render_variant(archetype, rank, direction, animation, frame, frame_count, args.size).save(
                            folder / f"frame_{frame:03d}.png", optimize=True
                        )
                        count_for_set += 1
            total += count_for_set
            reports.append({
                "archetype": archetype, "rank": rank, "frame_count": count_for_set,
                "palette": {k: list(v) for k, v in PALETTES[archetype].items()},
                "rank_accent": list(RANK_GOLD[rank]),
            })
    report = {
        "frame_size": args.size, "directions": args.directions, "animations": args.animations,
        "total_frames": total, "sets": reports,
        "generated_by": "procedural-pillow",
        "production_status": "prototype_placeholder_art",
        "note": "Archetype/rank palettes are variants of a shared warrior-derived silhouette; redraw class-specific anatomy, weapons, and gear before release.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    (args.output.parent / "character_variant_generation_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    print(f"Generated {total} prototype frames across {len(reports)} archetype/rank sets.")

if __name__ == "__main__":
    main()
