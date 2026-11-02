#!/usr/bin/env python3
"""Pixelate src_sheet/world_map.png (the DUNIA world map) into Game Boy-style map art.

  assets/gm_dunia.png    320 px wide, 32-colour palette (detail view)
  assets/gm_dunia_s.png  160 px wide, 32-colour palette (overview)
"""
import os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = Image.open(os.path.join(ROOT, "src_sheet", "world_map.png")).convert("RGB")
for name, w in (("gm_dunia", 320), ("gm_dunia_s", 160)):
    h = round(src.height * w / src.width)
    small = src.resize((w, h), Image.LANCZOS)
    q = small.quantize(colors=32, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGBA")
    q.save(os.path.join(ROOT, "assets", name + ".png"))
    print(name, q.size)
