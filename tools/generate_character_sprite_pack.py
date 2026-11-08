#!/usr/bin/env python3
"""Generate original Game Boy Color-inspired, class-distinct RPG sprite frames."""
import argparse, json
from pathlib import Path
from PIL import Image, ImageDraw
import generate_warrior_f_sprite as renderer

ARCHETYPES = ["warrior", "mage", "ranger", "rogue", "cleric", "summoner"]
RANKS = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"]
DIRECTIONS, ANIMATIONS = renderer.DIRECTIONS, list(renderer.ANIMS)
PALETTES = {
 "warrior":{"cloth":(48,89,154,255),"cloth_hi":(93,151,219,255),"steel":(142,164,190,255)},
 "mage":{"cloth":(91,53,157,255),"cloth_hi":(164,111,220,255),"steel":(122,144,193,255)},
 "ranger":{"cloth":(39,119,70,255),"cloth_hi":(112,183,91,255),"steel":(126,151,113,255)},
 "rogue":{"cloth":(48,55,83,255),"cloth_hi":(104,112,151,255),"steel":(139,148,168,255)},
 "cleric":{"cloth":(193,174,79,255),"cloth_hi":(247,222,127,255),"steel":(190,199,205,255)},
 "summoner":{"cloth":(117,47,105,255),"cloth_hi":(202,89,156,255),"steel":(147,105,169,255)},
}
RANK_GOLD = {"F":(150,150,150,255),"E":(125,190,218,255),"D":(66,170,224,255),"C":(103,129,235,255),"B":(179,104,222,255),"A":(242,183,72,255),"S":(239,103,91,255),"SS":(248,164,92,255),"SSS":(255,224,122,255)}
INK=(25,28,43,255); WHITE=(255,245,216,255); CYAN=(88,224,239,255)

def class_details(im, archetype, direction, frame):
 d=ImageDraw.Draw(im); left=direction in ("W","NW","SW")
 if archetype=="warrior":
  d.rectangle((49,22,78,27),fill=(224,190,91,255),outline=INK); d.rectangle((57,16,70,22),fill=(239,220,145,255),outline=INK)
  d.rectangle((40,49,49,61),fill=(198,207,218,255),outline=INK); d.rectangle((79,49,88,61),fill=(198,207,218,255),outline=INK)
 elif archetype=="mage":
  d.polygon([(48,31),(63,7),(79,31)],fill=(83,48,151,255),outline=INK); d.rectangle((46,29,81,34),fill=(128,76,196,255),outline=INK); d.rectangle((56,28,69,31),fill=(247,208,91,255),outline=INK)
  x=34 if left else 94; d.rectangle((x,31,x+4,106),fill=(130,79,48,255),outline=INK); d.rectangle((x-4,25,x+8,39),fill=CYAN,outline=INK); d.point((x+2,22),fill=WHITE)
 elif archetype=="ranger":
  d.polygon([(46,34),(50,19),(64,12),(79,20),(83,35),(74,30),(55,30)],fill=(35,112,61,255),outline=INK)
  d.polygon([(47,47),(34,66),(43,92),(57,80),(55,57)],fill=(38,137,74,255),outline=INK)
  x=31 if left else 96; d.arc((x-12,42,x+12,94),start=90 if left else 270,end=270 if left else 90,fill=(232,198,121,255),width=4); d.line((x,43,x,94),fill=WHITE,width=1)
 elif archetype=="rogue":
  d.polygon([(45,34),(50,18),(64,13),(79,19),(84,37),(75,32),(54,32)],fill=(43,48,73,255),outline=INK); d.rectangle((54,29,74,34),fill=(20,24,39,255))
  d.rectangle((57,31,61,33),fill=(236,207,130,255))
  for x in ((88,34) if left else (34,88)):
   d.polygon([(x,68),(x+5,72),(x+1,48),(x-2,46)],fill=(207,224,236,255),outline=INK); d.rectangle((x-1,70,x+6,75),fill=(146,93,55,255),outline=INK)
 elif archetype=="cleric":
  d.polygon([(47,35),(51,18),(64,12),(78,19),(82,35)],fill=(235,226,190,255),outline=INK); d.rectangle((57,48,71,63),fill=(248,241,210,255),outline=INK)
  d.rectangle((62,50,66,61),fill=(224,73,65,255)); d.rectangle((58,54,70,58),fill=(224,73,65,255)); d.ellipse((54,7,74,17),outline=(255,224,116,255),width=3)
  x=32 if left else 92; d.rectangle((x,40,x+4,104),fill=(147,93,51,255),outline=INK); d.rectangle((x-4,35,x+8,45),fill=(255,222,111,255),outline=INK)
 else:
  d.polygon([(47,34),(51,19),(64,14),(78,20),(82,35)],fill=(123,45,111,255),outline=INK); d.polygon([(50,24),(43,9),(59,19)],fill=(226,111,184,255),outline=INK); d.polygon([(69,19),(85,8),(78,27)],fill=(226,111,184,255),outline=INK)
  x=32 if left else 96; y=49+(frame%2)*2; d.ellipse((x-7,y-7,x+7,y+7),fill=CYAN,outline=INK); d.ellipse((x-3,y-3,x+2,y+2),fill=WHITE)
 d.polygon([(64,60),(69,65),(64,70),(59,65)],fill=RANK_GOLD["F"],outline=INK)

def render_variant(archetype,rank,direction,animation,frame,count,size):
 original=renderer.C.copy()
 try:
  renderer.C.update(PALETTES[archetype]); renderer.C["gold"]=RANK_GOLD[rank]
  boost=RANKS.index(rank); base=PALETTES[archetype]["steel"]
  renderer.C["steel_hi"]=tuple(min(255,c+boost*6) for c in base[:3])+(255,)
  image=renderer.render(direction,animation,frame,count,128)
  class_details(image,archetype,direction,frame)
  return image if size==128 else image.resize((size,size),Image.Resampling.NEAREST)
 finally:
  renderer.C.clear(); renderer.C.update(original)

def main():
 p=argparse.ArgumentParser(); p.add_argument("--output",type=Path,default=Path("assets_hd64/animations/frames"))
 p.add_argument("--size",type=int,choices=[64,128,256,512],default=128); p.add_argument("--archetypes",nargs="+",choices=ARCHETYPES,default=["warrior"])
 p.add_argument("--ranks",nargs="+",choices=RANKS,default=["F"]); p.add_argument("--directions",nargs="*",choices=DIRECTIONS,default=DIRECTIONS)
 p.add_argument("--animations",nargs="*",choices=ANIMATIONS,default=ANIMATIONS); args=p.parse_args(); total=0; reports=[]
 for archetype in args.archetypes:
  for rank in args.ranks:
   count_set=0
   for direction in args.directions:
    for animation in args.animations:
     frame_count,loop=renderer.ANIMS[animation]; folder=args.output/archetype/rank/direction/animation; folder.mkdir(parents=True,exist_ok=True)
     for frame in range(frame_count):
      render_variant(archetype,rank,direction,animation,frame,frame_count,args.size).save(folder/f"frame_{frame:03d}.png",optimize=True); count_set+=1
   total+=count_set; reports.append({"archetype":archetype,"rank":rank,"frame_count":count_set,"palette":{k:list(v) for k,v in PALETTES[archetype].items()},"rank_accent":list(RANK_GOLD[rank])})
 report={"frame_size":args.size,"directions":args.directions,"animations":args.animations,"total_frames":total,"sets":reports,"generated_by":"procedural-pillow-class-specific","production_status":"class_distinct_pixel_art_prototype","style":"Game Boy Color-inspired limited palette, crisp pixel edges, transparent PNG","note":"Original class-specific starter sprites; validate animation silhouettes in-game before release."}
 args.output.parent.mkdir(parents=True,exist_ok=True); (args.output.parent/"character_variant_generation_report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
 print(f"Generated {total} class-distinct pixel-art frames across {len(reports)} archetype/rank sets.")

if __name__=="__main__": main()
