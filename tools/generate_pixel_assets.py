#!/usr/bin/env python3
"""Generate original placeholder 8-bit sprite atlases using only Python stdlib.

These are procedural starter assets, not copies of commercial game art.
Run: python tools/generate_pixel_assets.py
"""
from pathlib import Path
import struct
import zlib

OUT = Path("assets/generated")
OUT.mkdir(parents=True, exist_ok=True)

PALETTES = {
    "gb": [(160,168,104,255),(112,124,72,255),(60,76,42,255),(22,32,18,255)],
    "fantasy": [(20,24,38,255),(54,76,88,255),(92,132,104,255),(174,184,126,255),
                (208,160,92,255),(154,78,66,255),(102,82,140,255),(226,218,184,255)]
}

def png(path, width, height, rgba):
    raw = b"".join(b"\x00" + bytes(rgba[y*width*4:(y+1)*width*4]) for y in range(height))
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag+data) & 0xffffffff)
    data = (b"\x89PNG\r\n\x1a\n" +
            chunk(b"IHDR", struct.pack(">2I5B", width, height, 8, 6, 0, 0, 0)) +
            chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    path.write_bytes(data)

def canvas(w, h, color=(0,0,0,0)):
    return [list(color) for _ in range(w*h)]

def put(img, w, x, y, color):
    if 0 <= x < w and 0 <= y < len(img)//w:
        i = y*w+x
        img[i] = list(color)

def rect(img, w, x, y, rw, rh, color):
    for yy in range(y, y+rh):
        for xx in range(x, x+rw):
            put(img,w,xx,yy,color)

def sprite(kind, index, pal):
    w=h=16
    img=canvas(w,h)
    dark, mid, light, hi = pal[0], pal[1], pal[2], pal[-1]
    # All shapes are deliberately simple, readable at 1x.
    if kind == "terrain":
        base=[mid,light,(194,176,112,255),(80,116,150,255),(110,110,118,255),(190,210,224,255)][index%6]
        rect(img,w,0,0,16,16,base)
        for n in range(12):
            x=(n*7+index*3)%16; y=(n*11+index*5)%16
            put(img,w,x,y,hi if n%3 else dark)
        if index%6 == 3:
            for y in range(2,15,4): rect(img,w,0,y,16,1,light)
    elif kind == "items":
        rect(img,w,6,3,4,10,light); rect(img,w,4,6,8,7,mid)
        rect(img,w,5,5,6,1,hi); rect(img,w,6,13,4,1,dark)
        put(img,w,7,8,hi); put(img,w,8,8,hi)
    elif kind == "creatures":
        rect(img,w,5,4,6,8,mid); rect(img,w,4,6,8,5,light)
        rect(img,w,3,2,3,3,dark); rect(img,w,10,2,3,3,dark)
        put(img,w,6,7,hi); put(img,w,9,7,hi)
        rect(img,w,5,12,2,3,dark); rect(img,w,9,12,2,3,dark)
    elif kind == "equipment":
        rect(img,w,7,2,2,9,light); rect(img,w,4,5,8,2,mid)
        rect(img,w,6,11,4,2,dark); rect(img,w,7,13,2,2,hi)
    elif kind == "effects":
        for r in range(1,8):
            rect(img,w,8-r,8-r,2*r,2,hi if r%2 else light)
            rect(img,w,8-r,8+r-2,2*r,2,mid)
        put(img,w,7,7,hi); put(img,w,8,8,hi)
    elif kind == "ui":
        rect(img,w,1,1,14,14,dark); rect(img,w,2,2,12,12,mid)
        rect(img,w,3,3,10,1,hi); rect(img,w,3,12,10,1,light)
        put(img,w,7,7,hi); put(img,w,8,8,hi)
    else:
        rect(img,w,3,4,10,9,mid); rect(img,w,4,3,8,1,light)
        rect(img,w,5,13,2,2,dark); rect(img,w,9,13,2,2,dark)
    return img

def make_atlas(kind, count, palette, columns=8):
    size=16; rows=(count+columns-1)//columns
    sheet=canvas(columns*size,rows*size)
    for i in range(count):
        spr=sprite(kind,i,palette)
        ox=(i%columns)*size; oy=(i//columns)*size
        for y in range(size):
            for x in range(size):
                sheet[(oy+y)*(columns*size)+(ox+x)] = spr[y*size+x]
    flat=[channel for pixel in sheet for channel in pixel]
    png(OUT/f"{kind}_atlas.png",columns*size,rows*size,flat)

if __name__ == "__main__":
    for kind in ("terrain","items","creatures","equipment","effects","ui","world_objects"):
        make_atlas(kind,64,PALETTES["fantasy"])
    make_atlas("terrain_gb",64,PALETTES["gb"])
    print(f"Generated original placeholder atlases in {OUT}")
