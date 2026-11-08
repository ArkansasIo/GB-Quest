#!/usr/bin/env python3
"""Pack directional animation PNGs into engine-friendly sprite sheets + JSON metadata."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw

ANIMATIONS = ["idle", "walk", "run", "attack", "cast", "block", "hit", "death"]
DIRECTIONS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", type=Path, default=Path("assets_hd64/animations/frames"))
    ap.add_argument("--output", type=Path, default=Path("assets_hd64/animations/atlases"))
    ap.add_argument("--archetype", default="warrior")
    ap.add_argument("--rank", default="F")
    ap.add_argument("--frame-size", type=int, default=128)
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    report = {"archetype": args.archetype, "rank": args.rank, "frame_size": args.frame_size,
              "sheets": [], "missing_frames": []}
    for animation in ANIMATIONS:
        sequences = {}
        max_frames = 0
        for direction in DIRECTIONS:
            folder = args.frames / args.archetype / args.rank / direction / animation
            frames = sorted(folder.glob("frame_*.png"), key=lambda p: p.name)
            sequences[direction] = frames
            max_frames = max(max_frames, len(frames))
        if max_frames == 0:
            continue
        sheet = Image.new("RGBA", (max_frames * args.frame_size, len(DIRECTIONS) * args.frame_size),
                          (0, 0, 0, 0))
        cells = []
        for row, direction in enumerate(DIRECTIONS):
            frames = sequences[direction]
            for col, path in enumerate(frames):
                with Image.open(path) as source:
                    frame = source.convert("RGBA")
                if frame.size != (args.frame_size, args.frame_size):
                    report["missing_frames"].append({"file": str(path), "error": "wrong dimensions",
                                                     "actual": list(frame.size)})
                    continue
                sheet.alpha_composite(frame, (col * args.frame_size, row * args.frame_size))
                cells.append({"direction": direction, "frame": col, "file": path.name,
                              "x": col * args.frame_size, "y": row * args.frame_size,
                              "width": args.frame_size, "height": args.frame_size})
            if not frames:
                report["missing_frames"].append({"sequence": f"{direction}/{animation}", "error": "no frames"})
        filename = f"{args.archetype}_{args.rank}_{animation}.png"
        sheet.save(args.output / filename, optimize=True)
        meta = {"image": filename, "frame_width": args.frame_size, "frame_height": args.frame_size,
                "columns": max_frames, "rows": len(DIRECTIONS), "directions": DIRECTIONS,
                "animation": animation, "frames": cells}
        (args.output / f"{args.archetype}_{args.rank}_{animation}.json").write_text(
            json.dumps(meta, indent=2), encoding="utf-8")
        report["sheets"].append({"animation": animation, "image": filename,
                                 "columns": max_frames, "rows": len(DIRECTIONS),
                                 "frames_packed": len(cells)})
    report["valid"] = not report["missing_frames"] and len(report["sheets"]) == len(ANIMATIONS)
    (args.output / "atlas_build_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Built {len(report['sheets'])} sheets; missing/invalid entries: {len(report['missing_frames'])}")
    if not report["valid"]:
        raise SystemExit("Atlas build incomplete; inspect atlas_build_report.json")

if __name__ == "__main__":
    main()
