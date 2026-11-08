#!/usr/bin/env python3
"""Generate deterministic prototype pixel-art frames for the GB-Quest F-rank warrior.

These are original procedural placeholder sprites for integration/testing, not final
hand-painted production character art. Pillow is the only dependency.
"""
import argparse
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

DIRECTIONS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"]
ANIMS = {
    "idle": (6, True), "walk": (8, True), "run": (8, True),
    "attack": (6, False), "cast": (8, False), "block": (4, False),
    "hit": (3, False), "death": (8, False),
}
SIZE = 128
C = {
    "outline": (28, 30, 42, 255), "steel": (112, 132, 151, 255),
    "steel_hi": (184, 198, 207, 255), "steel_dark": (66, 82, 101, 255),
    "leather": (104, 66, 43, 255), "leather_hi": (151, 101, 61, 255),
    "skin": (205, 157, 119, 255), "skin_shadow": (145, 99, 77, 255),
    "cloth": (74, 91, 125, 255), "cloth_hi": (111, 135, 174, 255),
    "gold": (202, 164, 79, 255), "shadow": (18, 20, 29, 110),
    "white": (236, 235, 220, 255), "red": (151, 59, 55, 255),
}

def rect(d, box, fill, outline=C["outline"]):
    d.rectangle(tuple(int(v) for v in box), fill=fill, outline=outline)

def polygon(d, points, fill, outline=C["outline"]):
    d.polygon([(int(x), int(y)) for x, y in points], fill=fill, outline=outline)

def render(direction, animation, frame, count, size=SIZE):
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    t = frame / max(1, count - 1)
    # Eight-way facing changes the silhouette's lateral offset and sword hand.
    facing = {"S": 0, "SW": -1, "W": -2, "NW": -1, "N": 0, "NE": 1, "E": 2, "SE": 1}[direction]
    back_view = direction in ("N", "NW", "NE")
    side_view = direction in ("W", "E", "NW", "NE")
    mirror = direction in ("W", "NW", "SW")
    bob = int(round(math.sin(t * math.tau) * (2 if animation in ("idle", "walk", "run") else 1)))
    stride = math.sin(t * math.tau) if animation in ("walk", "run") else 0
    if animation == "run":
        stride *= 1.55
    if animation == "hit":
        facing = -2 if frame < count // 2 else -1
    if animation == "death":
        bob = -int(t * 20)
    cx = 64 + facing * 3
    cy = 57 + bob
    if animation == "death":
        cy += int(t * 18)
    # Ground shadow.
    d.ellipse((cx-23, 105, cx+23, 114), fill=C["shadow"])
    # Legs and boots; alternating gait creates readable frame changes.
    leg_a = int(stride * 8)
    leg_b = -leg_a
    if animation == "attack":
        leg_a = int(math.sin(t * math.pi) * 4)
    if animation == "death":
        leg_a, leg_b = int(t * 13), -int(t * 8)
    if animation == "block":
        leg_a, leg_b = -2, 2
    rect(d, (cx-13+leg_a, cy+22, cx-4+leg_a, cy+43), C["steel_dark"])
    rect(d, (cx+3+leg_b, cy+22, cx+12+leg_b, cy+43), C["steel"])
    rect(d, (cx-15+leg_a, cy+39, cx-2+leg_a, cy+46), C["leather"])
    rect(d, (cx+1+leg_b, cy+39, cx+14+leg_b, cy+46), C["leather"])
    # Mail/cloth torso and shoulder plates.
    polygon(d, [(cx-15,cy-7),(cx+14,cy-7),(cx+17,cy+22),(cx-16,cy+22)], C["cloth"])
    polygon(d, [(cx-15,cy-7),(cx-4,cy-11),(cx+1,cy+19),(cx-16,cy+22)], C["cloth_hi"])
    rect(d, (cx-16, cy-8, cx-8, cy+2), C["steel"])
    rect(d, (cx+8, cy-8, cx+16, cy+2), C["steel"])
    rect(d, (cx-14, cy+8, cx+14, cy+12), C["leather"])
    rect(d, (cx-3, cy+7, cx+3, cy+13), C["gold"])
    # Head, neck, and simple F-rank helmet.
    rect(d, (cx-5, cy-16, cx+5, cy-8), C["skin"])
    rect(d, (cx-10, cy-32, cx+10, cy-14), C["skin"])
    polygon(d, [(cx-11,cy-26),(cx-9,cy-37),(cx+8,cy-37),(cx+11,cy-26),(cx+7,cy-22),(cx-8,cy-22)], C["steel"])
    rect(d, (cx-8, cy-32, cx+8, cy-29), C["steel_hi"])
    if back_view:
        rect(d, (cx-7, cy-28, cx+7, cy-20), C["steel_dark"])
    else:
        rect(d, (cx-7, cy-25, cx+7, cy-23), C["outline"])
    # Sword arm and blade: each animation changes its angle/position.
    sword_x = cx + (18 if not mirror else -18)
    sword_y = cy + 5
    angle = -1.0
    if animation == "attack":
        angle = -1.0 + t * 2.0
        sword_y -= int(math.sin(t * math.pi) * 19)
    elif animation == "block":
        angle = -2.3
        sword_y -= 8
    elif animation == "cast":
        angle = -0.2
        sword_y -= 7
    elif animation == "hit":
        angle = 1.1
    elif animation == "death":
        angle = 1.5
    elif animation == "run":
        angle = -0.6 + stride * 0.35
    elif animation == "walk":
        angle = -0.8 + stride * 0.25
    if mirror:
        angle = math.pi - angle
    arm_end = (sword_x + math.cos(angle)*12, sword_y + math.sin(angle)*12)
    rect(d, (min(cx+10,sword_x)-3, min(cy-4,sword_y)-3, max(cx+10,sword_x)+3, max(cy-4,sword_y)+3), C["leather"])
    d.line((sword_x, sword_y, *arm_end), fill=C["skin"], width=5)
    blade_start = arm_end
    blade_end = (blade_start[0] + math.cos(angle)*27, blade_start[1] + math.sin(angle)*27)
    d.line((blade_start, blade_end), fill=C["steel_hi"], width=5)
    d.line((blade_start, blade_end), fill=C["white"], width=2)
    # Crossguard and pommel.
    gx, gy = blade_start
    d.line((gx-math.sin(angle)*6, gy+math.cos(angle)*6,
            gx+math.sin(angle)*6, gy-math.cos(angle)*6), fill=C["gold"], width=3)
    # Shield appears on defensive frames and on the off-hand during idle/movement.
    if animation in ("block", "idle", "walk", "run"):
        sx = cx - 23 if not mirror else cx + 23
        sy = cy + (0 if animation == "block" else 5)
        polygon(d, [(sx,sy-12),(sx+9,sy-9),(sx+8,sy+9),(sx,sy+15),(sx-8,sy+9),(sx-9,sy-9)], C["steel_dark"])
        polygon(d, [(sx,sy-8),(sx+5,sy-6),(sx+4,sy+7),(sx,sy+10),(sx-5,sy+7),(sx-5,sy-6)], C["steel"])
        rect(d, (sx-1, sy-5, sx+1, sy+7), C["gold"], outline=None)
    # Rank badge accent on chest.
    polygon(d, [(cx,cy-4),(cx+4,cy),(cx,cy+4),(cx-4,cy)], C["gold"], outline=None)
    # Preserve crisp pixels; no resampling/antialiasing.
    if size != SIZE:
        im = im.resize((size, size), Image.Resampling.NEAREST)
    return im

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--output", type=Path, default=Path("assets_hd64/animations/frames"))
    p.add_argument("--size", type=int, choices=[64, 128, 256, 512], default=128)
    p.add_argument("--directions", nargs="*", choices=DIRECTIONS, default=DIRECTIONS)
    p.add_argument("--animations", nargs="*", choices=list(ANIMS), default=list(ANIMS))
    args = p.parse_args()
    total = 0
    for direction in args.directions:
        for animation in args.animations:
            count, loop = ANIMS[animation]
            folder = args.output / "warrior" / "F" / direction / animation
            folder.mkdir(parents=True, exist_ok=True)
            for frame in range(count):
                render(direction, animation, frame, count, args.size).save(
                    folder / f"frame_{frame:03d}.png", optimize=True
                )
                total += 1
    report = {
        "archetype": "warrior", "rank": "F", "directions": args.directions,
        "animations": args.animations, "frame_size": args.size,
        "frame_count": total, "generated_by": "procedural-pillow",
        "production_status": "prototype_placeholder_art",
        "note": "Original deterministic pixel-art prototype; requires artist review and polish."
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    (args.output.parent / "warrior_f_generation_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    print(f"Generated {total} F-rank warrior frames at {args.size}x{args.size}px.")

if __name__ == "__main__":
    main()
