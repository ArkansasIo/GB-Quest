#!/usr/bin/env python3
"""Create a production-ready animation sequence manifest and folder scaffold.

This does not fabricate animation artwork. It defines the frame contract for authored
sprites and can validate completed frame folders when --validate is supplied.
"""
import argparse, csv, json
from pathlib import Path

RANKS = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"]
DIRECTIONS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"]
ARCHETYPES = ["warrior", "mage", "ranger", "rogue", "cleric", "summoner"]
ANIMATIONS = {
    "idle": (6, True), "walk": (8, True), "run": (8, True),
    "attack": (6, False), "cast": (8, False), "block": (4, False),
    "hit": (3, False), "death": (8, False),
}

def build_rows(root: Path, frame_size: int):
    rows = []
    for archetype in ARCHETYPES:
        for rank in RANKS:
            for direction in DIRECTIONS:
                for animation, (count, loop) in ANIMATIONS.items():
                    key = f"{archetype}_{rank}_{direction}_{animation}"
                    folder = Path(archetype) / rank / direction / animation
                    rows.append({
                        "sequence_id": key, "archetype": archetype, "rank": rank,
                        "direction": direction, "animation": animation,
                        "frame_count": count, "loop": loop, "frame_width": frame_size,
                        "frame_height": frame_size, "frame_format": "PNG RGBA",
                        "folder": str(root / folder),
                        "filename_pattern": "frame_{index:03d}.png",
                        "status": "planned"
                    })
    return rows

def validate(rows):
    errors = []
    for row in rows:
        folder = Path(row["folder"])
        frames = [folder / row["filename_pattern"].format(index=i)
                  for i in range(row["frame_count"])]
        missing = [str(p) for p in frames if not p.is_file()]
        if missing:
            errors.append({"sequence_id": row["sequence_id"], "missing_frames": missing})
    return errors

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=Path, default=Path("assets_hd64/animations"))
    ap.add_argument("--frame-size", type=int, choices=[64, 128, 256, 512], default=128)
    ap.add_argument("--validate", action="store_true")
    args = ap.parse_args()
    rows = build_rows(args.output / "frames", args.frame_size)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "animation_manifest.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    with (args.output / "animation_manifest.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader(); writer.writerows(rows)
    summary = {
        "sequence_count": len(rows),
        "frame_count_target": sum(r["frame_count"] for r in rows),
        "archetypes": ARCHETYPES, "ranks": RANKS, "directions": DIRECTIONS,
        "animations": {k: {"frames": v[0], "loop": v[1]} for k, v in ANIMATIONS.items()},
        "frame_size": args.frame_size,
        "artwork_generated": False,
        "note": "Manifest and folders only; frame PNGs must be authored or imported."
    }
    (args.output / "animation_pack_report.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    if args.validate:
        errors = validate(rows)
        (args.output / "animation_validation.json").write_text(json.dumps({
            "valid": not errors, "missing_sequence_count": len(errors), "errors": errors
        }, indent=2), encoding="utf-8")
        if errors:
            raise SystemExit(f"Animation validation failed: {len(errors)} sequences have missing frames.")
    print(f"Wrote {len(rows)} sequence definitions ({summary['frame_count_target']} target frames).")

if __name__ == "__main__":
    main()
