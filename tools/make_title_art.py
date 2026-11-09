#!/usr/bin/env python3
"""Title screen art from art_source/title/lanterns_of_aelmoor_title.png (the project's own key art, 512x325).

The game screen is 160x144, so the art is cropped to that aspect around the logo and party. The crop puts the
key art's baked-in menu panel exactly where the Title scene draws its live menu (x 76-160, y 64-134 on the
160x144 screen), and the footer bar covers the bottom caption line.

    python tools/make_title_art.py
writes assets/title_aelmoor.png (160x144, the framebuffer backdrop) and
       assets/title_aelmoor_hi.png (the crop at source resolution, drawn sharp by the 64-BIT presenter)
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'art_source' / 'title' / 'lanterns_of_aelmoor_title.png'
CROP_X = 60                      # left edge of the 160:144 window in source pixels


def main():
    im = Image.open(SRC).convert('RGB')
    w = round(im.height * 160 / 144)
    crop = im.crop((CROP_X, 0, CROP_X + w, im.height))
    crop.save(ROOT / 'assets' / 'title_aelmoor_hi.png')
    crop.resize((160, 144), Image.LANCZOS).save(ROOT / 'assets' / 'title_aelmoor.png')
    print('title art:', crop.size, '-> 160x144')


if __name__ == '__main__':
    main()
