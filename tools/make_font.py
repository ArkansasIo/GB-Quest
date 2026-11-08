#!/usr/bin/env python3
"""Build assets/font_6x9.png: ASCII 32..126 in one row of 6x9 white glyphs.

Uses the classic X11 6x9 bitmap font (koi6x9.pcf.gz, ASCII half). If you'd
rather use your own font, just replace font_6x9.png with any 570x9 strip.
"""
import gzip, os, tempfile
from PIL import Image, ImageDraw, ImageFont, PcfFontFile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PCF = "/usr/share/fonts/X11/cyrillic/koi6x9.pcf.gz"
tmp = tempfile.mkdtemp()
PcfFontFile.PcfFontFile(gzip.open(PCF), "iso8859-1").save(os.path.join(tmp, "f"))
ft = ImageFont.load(os.path.join(tmp, "f.pil"))
W, H = 6, 9
atlas = Image.new("RGBA", (W * 95, H), (0, 0, 0, 0))
d = ImageDraw.Draw(atlas)
for i in range(1, 95):
    d.text((i * W, 0), chr(32 + i - 1), font=ft, fill=(255, 255, 255, 255))  # font table is offset by one
atlas.save(os.path.join(ROOT, "assets", "font_6x9.png"))
print("wrote assets/font_6x9.png")
