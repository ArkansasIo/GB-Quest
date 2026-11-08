#!/usr/bin/env python3
"""Generate 6,144 deterministic, original 8-bit RPG PNG assets.
Run: python3 tools/generate_6000_assets.py
Optional: --count-per-family 500 --output assets/generated_catalog --seed 20261107
Uses Python standard library only; writes one transparent PNG per stable asset ID.
"""
import argparse, json, random, struct, zlib
from pathlib import Path

FAMILIES = {
 "terrain":["grass","earth","sand","snow","stone","water","lava","marsh"],
 "flora":["trees","shrubs","flowers","mushrooms","reeds","crystals"],
 "buildings":["houses","shops","towers","castles","ruins","dungeons"],
 "props":["chests","barrels","crates","furniture","signs","camp_props"],
 "characters":["warriors","mages","rangers","clerics","rogues","crafters"],
 "monsters":["beasts","undead","goblins","elementals","dragons","aberrations"],
 "bosses":["world_bosses","dungeon_bosses","raid_bosses","guardians"],
 "weapons":["swords","axes","maces","spears","bows","daggers","staves","wands"],
 "armor":["helmets","chestplates","gloves","boots","shields","cloaks"],
 "items":["potions","food","materials","gems","keys","treasure","quest_items"],
 "icons":["classes","skills","stats","currencies","professions","factions"],
 "effects":["fire","frost","lightning","holy","shadow","poison","healing"],
 "ui":["frames","buttons","panels","markers","status","inventory_slots"],
 "mounts":["horses","wolves","stags","drakes","birds","fantasy_mounts"],
 "portraits":["human","elf","dwarf","orc","halfling","beastfolk"],
 "dungeon_tiles":["crypt","cavern","temple","fortress","sewer","volcanic"]
}
PALETTES=[
 [(18,26,35,255),(46,66,66,255),(91,125,87,255),(164,185,119,255),(226,220,167,255)],
 [(27,24,43,255),(66,52,89,255),(119,83,127,255),(186,132,153,255),(242,207,178,255)],
 [(25,33,57,255),(48,83,120,255),(76,137,167,255),(142,196,198,255),(226,240,218,255)],
 [(42,29,26,255),(103,55,39,255),(164,91,48,255),(218,151,76,255),(246,215,142,255)],
 [(27,33,31,255),(57,82,67,255),(99,130,83,255),(162,177,105,255),(222,218,153,255)],
 [(28,30,42,255),(71,76,91,255),(119,130,145,255),(184,194,202,255),(239,240,226,255)],
 [(36,20,30,255),(91,36,49,255),(157,57,57,255),(220,111,65,255),(255,190,105,255)],
 [(22,29,43,255),(51,55,87,255),(85,90,147,255),(139,146,205,255),(215,219,255,255)]
]
CLEAR=(0,0,0,0)
def save_png(path,w,h,pixels):
 raw=b"".join(b"\0"+bytes(c for px in pixels[y*w:(y+1)*w] for c in px) for y in range(h))
 def chunk(tag,data): return struct.pack(">I",len(data))+tag+data+struct.pack(">I",zlib.crc32(tag+data)&0xffffffff)
 data=b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">2I5B",w,h,8,6,0,0,0))+chunk(b"IDAT",zlib.compress(raw,9))+chunk(b"IEND",b"")
 path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(data)
def render(family,subtype,index,size,seed):
 r=random.Random(seed); pal=PALETTES[(index+len(family)+len(subtype))%len(PALETTES)]
 w=h=size; p=[CLEAR]*(w*h); cx=w//2
 def put(x,y,c):
  if 0<=x<w and 0<=y<h:p[y*w+x]=c
 def rect(x,y,rw,rh,c):
  for yy in range(y,y+rh):
   for xx in range(x,x+rw):put(xx,yy,c)
 def line(x1,y1,x2,y2,c):
  dx,dy=abs(x2-x1),-abs(y2-y1); sx=1 if x1<x2 else -1; sy=1 if y1<y2 else -1; err=dx+dy
  while True:
   put(x1,y1,c)
   if (x1,y1)==(x2,y2):break
   e=2*err
   if e>=dy:err+=dy;x1+=sx
   if e<=dx:err+=dx;y1+=sy
 d,a,b,hi=pal[0],pal[1],pal[2],pal[4]
 if family in ("terrain","dungeon_tiles"):
  rect(0,0,w,h,pal[1+index%3])
  for _ in range(size*2):put(r.randrange(w),r.randrange(h),r.choice(pal[2:]))
  if subtype in ("water","lava","sewer","volcanic"):
   for y in range(2,h,5):line(0,y,w-1,y+r.choice([-1,0,1]),hi)
  else:
   for x in range(0,w,4):line(x,0,x,h-1,d)
 elif family in ("characters","monsters","bosses","mounts","portraits"):
  head=max(3,size//4); body=max(4,size//3)
  rect(cx-head//2,2,head,head,pal[3]); rect(cx-body//2,2+head,body,body,pal[2])
  rect(cx-body//2-1,2+head+body-2,2,max(3,size//4),a);rect(cx+body//2-1,2+head+body-2,2,max(3,size//4),a)
  put(cx-1,2+head//2,d);put(cx+1,2+head//2,d)
  if family in ("monsters","bosses"):line(cx-head//2,3,cx-head//2-2,0,hi);line(cx+head//2-1,3,cx+head//2+2,0,hi)
  if family=="mounts":rect(2,size//2,size-4,size//4,pal[2]);line(3,size//2+2,1,size-2,d)
 elif family=="weapons":
  line(cx,1,cx,size-5,hi);line(cx-3,size//3,cx+3,size//3,b);rect(cx-2,size-5,4,3,a)
  if subtype=="bows":line(cx-4,2,cx-4,size-4,hi);line(cx+4,2,cx+4,size-4,hi);line(cx-4,2,cx+4,size-4,a)
 elif family=="armor":
  rect(w//4,h//4,w//2,h//2,pal[2]);rect(w//3,h//3,w//3,h//3,pal[3]);line(w//4,h//4,cx,1,hi)
 elif family in ("items","icons"):
  shape=index%4
  if shape==0:rect(cx-3,3,6,h-6,pal[3]);rect(cx-4,5,8,2,hi);rect(cx-3,h-4,6,2,d)
  elif shape==1:rect(cx-4,cx-4,8,8,pal[2]);rect(cx-2,cx-2,4,4,hi)
  elif shape==2:line(cx,2,cx,h-3,hi);line(2,cx,w-3,cx,b)
  else:rect(cx-3,cx-3,6,6,pal[3]);put(cx,cx,hi)
 elif family=="effects":
  for rr in range(1,size//2+1):
   for dx,dy in ((rr,0),(-rr,0),(0,rr),(0,-rr),(rr,rr),(-rr,rr),(rr,-rr),(-rr,-rr)):put(cx+dx,cx+dy,pal[2+rr%3])
  put(cx,cx,hi)
 elif family=="ui":
  rect(1,1,w-2,h-2,d);rect(2,2,w-4,h-4,a);rect(3,3,w-6,1,hi);rect(3,h-4,w-6,1,b)
 elif family=="buildings":
  rect(3,h//2,w-6,h//2-2,pal[2]);rect(2,h//2-2,w-4,3,pal[3]);line(2,h//2-2,cx,2,hi);line(cx,2,w-3,h//2-2,hi)
 elif family=="flora":
  rect(cx-1,h//2,2,h//2,pal[1])
  for _ in range(5):rect(r.randrange(2,w-3),r.randrange(2,h//2+2),3,2,pal[2+r.randrange(2)])
  put(cx,h//3,hi)
 else:
  rect(3,h//3,w-6,h//2,pal[2]);rect(3,h//3,w-6,2,hi);rect(cx-2,h//2,4,3,d)
 for _ in range(3):
  x,y=r.randrange(w),r.randrange(h)
  if p[y*w+x][3]:p[y*w+x]=hi
 return p
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--count-per-family",type=int,default=384);ap.add_argument("--output",default="assets/generated_catalog");ap.add_argument("--seed",type=int,default=20261107);args=ap.parse_args()
 if args.count_per_family<1:raise SystemExit("--count-per-family must be positive")
 root=Path(args.output);records=[]
 for family,subtypes in FAMILIES.items():
  for n in range(args.count_per_family):
   subtype=subtypes[n%len(subtypes)];size=(16,24,32)[(n//len(subtypes))%3];seed=args.seed+sum(map(ord,family))*1009+n*7919
   aid=f"{family}_{n+1:04d}";rel=Path(family)/f"{aid}.png"
   save_png(root/rel,size,size,render(family,subtype,n,size,seed))
   records.append({"id":aid,"family":family,"subtype":subtype,"path":rel.as_posix(),"width":size,"height":size,"seed":seed,"source":"tools/generate_6000_assets.py"})
 manifest={"schemaVersion":1,"title":"GB Quest Aelmoor Original 8-bit Asset Catalog","generatedCount":len(records),"familyCount":len(FAMILIES),"countPerFamily":args.count_per_family,"seed":args.seed,"pixelArt":{"transparentBackground":True,"filter":"nearest-neighbor","nativeSizes":[16,24,32],"originalArtworkOnly":True},"assets":records}
 root.mkdir(parents=True,exist_ok=True);(root/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
 print(f"Generated {len(records):,} individual PNG assets in {root}")
if __name__=="__main__":main()
