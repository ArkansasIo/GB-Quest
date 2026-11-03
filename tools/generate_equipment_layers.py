#!/usr/bin/env python3
"""Generate transparent equipment overlay prototypes and an engine-readable manifest.

These are deliberately simple integration layers, not final authored equipment art.
Each layer uses the character frame canvas and a stable feet-origin coordinate space.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw

DIRECTIONS = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"]
RANKS = ["F", "E", "D", "C", "B", "A", "S", "SSS"]
SLOTS = {
    "head": ["iron_helm", "mage_hood", "ranger_hood", "rogue_mask", "cleric_circlet"],
    "chest": ["iron_plate", "traveler_tunic", "arcane_robe", "shadow_leathers", "sanctified_mail"],
    "legs": ["iron_greaves", "travel_trousers", "arcane_lower_robe"],
    "hands": ["iron_gauntlets", "leather_gloves", "spell_gloves"],
    "main_hand": ["iron_sword", "oak_staff", "short_bow", "paired_daggers", "holy_mace"],
    "off_hand": ["iron_shield", "spell_focus", "quiver"],
    "back": ["short_cloak", "ranger_cape", "summoner_mantle"],
    "accessory": ["gold_amulet", "rune_pendant", "guild_medallion"],
}
RANK_COLORS = {
    "F": (145, 151, 160, 255), "E": (105, 155, 180, 255),
    "D": (70, 145, 205, 255), "C": (105, 115, 210, 255),
    "B": (155, 95, 195, 255), "A": (210, 155, 65, 255),
    "S": (210, 85, 75, 255), "SSS": (245, 215, 115, 255),
}
SLOT_ANCHORS = {
    "head": (64, 29), "chest": (64, 61), "legs": (64, 91),
    "hands": (43, 63), "main_hand": (88, 65), "off_hand": (39, 70),
    "back": (64, 64), "accessory": (72, 53),
}

def draw_item(draw, slot, item, color, facing):
    x, y = SLOT_ANCHORS[slot]
    # Small directional offsets keep overlays aligned to the prototype's facing.
    if facing in ("W", "NW", "SW"):
        x -= 3
    elif facing in ("E", "NE", "SE"):
        x += 3
    if facing in ("N", "NW", "NE") and slot in ("head", "back", "main_hand"):
        y -= 2
    if facing in ("W", "E", "NW", "NE") and slot in ("main_hand", "off_hand"):
        y += 1
    if slot == "head":
        if "hood" in item or "mask" in item:
            draw.polygon([(x-11,y-9),(x+11,y-9),(x+9,y+9),(x,y+14),(x-9,y+9)], fill=color, outline=(24,25,34,255))
            draw.rectangle((x-7,y-1,x+7,y+2), fill=(28,30,42,255))
        else:
            draw.arc((x-12,y-13,x+12,y+11), 180, 360, fill=color, width=5)
            draw.line((x-12,y-1,x+12,y-1), fill=color, width=4)
    elif slot == "chest":
        draw.polygon([(x-15,y-12),(x+15,y-12),(x+13,y+15),(x-13,y+15)], fill=color, outline=(24,25,34,255))
        draw.line((x,y-9,x,y+12), fill=(235,225,190,255), width=2)
    elif slot == "legs":
        draw.polygon([(x-13,y-10),(x-2,y-10),(x-4,y+13),(x-14,y+13)], fill=color, outline=(24,25,34,255))
        draw.polygon([(x+2,y-10),(x+13,y-10),(x+14,y+13),(x+4,y+13)], fill=color, outline=(24,25,34,255))
    elif slot == "hands":
        draw.rounded_rectangle((x-6,y-7,x+6,y+8), radius=3, fill=color, outline=(24,25,34,255))
    elif slot == "main_hand":
        if "staff" in item or "mace" in item:
            draw.line((x,y+17,x+(-5 if facing in ("W","NW","SW") else 5),y-19), fill=color, width=4)
            draw.ellipse((x-5,y-24,x+5,y-14), fill=color, outline=(24,25,34,255))
        elif "bow" in item:
            draw.arc((x-10,y-20,x+10,y+20), 260, 100, fill=color, width=4)
            draw.line((x+2,y-18,x+2,y+18), fill=(225,220,200,255), width=1)
        elif "dagger" in item:
            draw.line((x,y+12,x,y-16), fill=color, width=3)
            draw.polygon([(x-4,y-12),(x,y-23),(x+4,y-12)], fill=(210,220,230,255))
        else:
            draw.line((x,y+15,x,y-18), fill=color, width=5)
            draw.polygon([(x-5,y-14),(x,y-27),(x+5,y-14)], fill=(210,220,230,255))
            draw.line((x-7,y-9,x+7,y-9), fill=(225,195,100,255), width=3)
    elif slot == "off_hand":
        if "focus" in item:
            draw.ellipse((x-8,y-8,x+8,y+8), fill=color, outline=(24,25,34,255))
            draw.ellipse((x-3,y-3,x+3,y+3), fill=(220,235,255,255))
        elif "quiver" in item:
            draw.rounded_rectangle((x-5,y-15,x+5,y+15), radius=3, fill=color, outline=(24,25,34,255))
            for dx in (-3,0,3):
                draw.line((x+dx,y-12,x+dx,y-20), fill=(225,220,200,255), width=1)
        else:
            draw.polygon([(x,y-15),(x+11,y-10),(x+9,y+9),(x,y+16),(x-9,y+9),(x-11,y-10)], fill=color, outline=(24,25,34,255))
            draw.line((x,y-9,x,y+10), fill=(235,215,145,255), width=2)
    elif slot == "back":
        draw.polygon([(x-13,y-12),(x+13,y-12),(x+17,y+23),(x,y+15),(x-17,y+23)], fill=color, outline=(24,25,34,255))
    elif slot == "accessory":
        draw.ellipse((x-5,y-5,x+5,y+5), outline=color, width=3)
        draw.line((x,y+5,x,y+14), fill=color, width=2)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=Path, default=Path("assets_hd64/equipment"))
    ap.add_argument("--size", type=int, choices=[64,128,256,512], default=128)
    ap.add_argument("--ranks", nargs="+", choices=RANKS, default=RANKS)
    ap.add_argument("--directions", nargs="+", choices=DIRECTIONS, default=DIRECTIONS)
    ap.add_argument("--slots", nargs="+", choices=list(SLOTS), default=list(SLOTS))
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = {
        "schema_version": 1, "canvas": {"width": args.size, "height": args.size},
        "coordinate_space": "character_frame_pixels", "origin": "top_left",
        "pivot": {"x": args.size // 2, "y": int(args.size * 0.88)},
        "directions": args.directions, "slots": {}, "items": [],
        "production_status": "prototype_placeholder_art",
    }
    scale = args.size / 128
    for slot in args.slots:
        manifest["slots"][slot] = {"anchor": [round(v*scale, 2) for v in SLOT_ANCHORS[slot]],
                                   "draw_order": list(SLOTS).index(slot)}
        for item in SLOTS[slot]:
            for rank in args.ranks:
                color = RANK_COLORS[rank]
                for direction in args.directions:
                    image = Image.new("RGBA", (128,128), (0,0,0,0))
                    draw_item(ImageDraw.Draw(image), slot, item, color, direction)
                    if args.size != 128:
                        image = image.resize((args.size,args.size), Image.Resampling.NEAREST)
                    rel = Path("layers") / slot / item / rank / f"{direction}.png"
                    target = args.output / rel
                    target.parent.mkdir(parents=True, exist_ok=True)
                    image.save(target, optimize=True)
                    manifest["items"].append({
                        "id": item, "slot": slot, "rank": rank, "direction": direction,
                        "path": rel.as_posix(), "anchor": [round(v*scale,2) for v in SLOT_ANCHORS[slot]],
                        "tint_rgba": list(color), "blend": "normal", "offset": [0,0],
                    })
    (args.output / "equipment_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {len(manifest['items'])} transparent equipment layers to {args.output}")

if __name__ == "__main__":
    main()
