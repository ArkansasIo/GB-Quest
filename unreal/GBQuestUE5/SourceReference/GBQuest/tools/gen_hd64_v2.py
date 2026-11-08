#!/usr/bin/env python3
"""Generate original HD64 fantasy companion assets; legacy assets are preserved."""
import argparse, hashlib, json, math, random
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/"assets_hd64_v2"
FAMILIES={"characters":["adventurer","mage","ranger","guardian","cleric","rogue","druid","artisan","villager","merchant"],"creatures":["wolf","bear","wraith","golem","wyvern","dragon","spider","elemental","troll","giant"],"bosses":["ancient_dragon","lich_king","void_titan","storm_colossus","hollow_queen"],"weapons":["sword","greatsword","axe","warhammer","spear","dagger","bow","staff","wand","shield"],"armor":["helmet","plate","leather","robe","cloak","gauntlets","boots","shield"],"items":["potion","elixir","rune","gem","herb","ore","relic","key","scroll","treasure"],"terrain":["grass","forest","desert","snow","swamp","volcanic","coast","mountain","road","river"],"buildings":["keep","tavern","blacksmith","market","temple","tower","farm","harbor","gate","house"],"dungeons":["crypt","catacomb","mine","fortress","sanctum","cavern","ruins","vault"],"effects":["fire","frost","lightning","arcane","holy","shadow","poison","healing","impact","portal"],"ui":["panel","button","frame","inventory_slot","quest_marker","map_pin","rarity_badge","resource_icon"],"portraits":["human","elf","dwarf","orc","halfling","tiefling","dragonkin","undead"]}
PALETTES=[((19,27,38),(42,65,76),(76,122,117),(153,181,143),(235,220,171)),((28,22,43),(70,45,85),(130,74,118),(204,125,144),(250,207,185)),((18,34,52),(35,82,113),(61,139,164),(137,202,204),(225,239,217)),((41,30,25),(91,55,38),(151,94,53),(208,153,83),(246,216,151)),((26,29,39),(67,76,91),(118,133,146),(180,191,192),(239,229,205)),((27,24,45),(71,55,116),(122,90,174),(185,143,219),(235,211,249)),((28,42,29),(56,91,48),(94,142,63),(163,190,95),(224,219,157))]
def seedof(s): return int(hashlib.sha256(s.encode()).hexdigest()[:16],16)
def art(fam,name,size,seed):
 rng=random.Random(seed); dark,shadow,mid,light,gold=PALETTES[seed%len(PALETTES)]; k=size/128; P=lambda n:int(n*k); w=max(2,P(2))
 im=Image.new("RGBA",(size,size),(0,0,0,0)); d=ImageDraw.Draw(im)
 if fam in ("characters","creatures","bosses","portraits"):
  d.ellipse((P(25),P(111),P(103),P(122)),fill=(7,9,16,110))
  if fam in ("creatures","bosses"):
   d.polygon([(P(36),P(53)),(P(9),P(35)),(P(17),P(74)),(P(43),P(85))],fill=shadow,outline=dark); d.polygon([(P(92),P(53)),(P(119),P(35)),(P(111),P(74)),(P(85),P(85))],fill=shadow,outline=dark)
  else: d.polygon([(P(37),P(53)),(P(19),P(102)),(P(109),P(102)),(P(91),P(53))],fill=shadow,outline=dark)
  d.polygon([(P(39),P(49)),(P(89),P(49)),(P(101),P(105)),(P(27),P(105))],fill=mid,outline=dark); d.polygon([(P(43),P(55)),(P(85),P(55)),(P(91),P(91)),(P(37),P(91))],fill=light,outline=shadow)
  d.polygon([(P(43),P(55)),(P(64),P(67)),(P(85),P(55)),(P(78),P(86)),(P(64),P(95)),(P(50),P(86))],fill=mid)
  d.rounded_rectangle((P(19),P(52),P(43),P(77)),radius=P(6),fill=light,outline=dark,width=w); d.rounded_rectangle((P(85),P(52),P(109),P(77)),radius=P(6),fill=mid,outline=dark,width=w)
  d.rounded_rectangle((P(54),P(35),P(74),P(57)),radius=P(5),fill=shadow); d.ellipse((P(42),P(9),P(86),P(56)),fill=light,outline=dark,width=w); d.pieslice((P(42),P(7),P(86),P(57)),180,355,fill=shadow,outline=dark,width=w)
  for x in (53,70): d.ellipse((P(x),P(31),P(x+5),P(36)),fill=gold)
  d.arc((P(56),P(37),P(72),P(48)),5,165,fill=dark,width=w); v=seed%4
  if v==0: d.polygon([(P(42),P(21)),(P(30),P(1)),(P(53),P(13)),(P(65),P(0)),(P(77),P(14)),(P(99),P(1)),(P(85),P(29))],fill=gold,outline=dark)
  elif v==1: d.polygon([(P(43),P(18)),(P(18),P(2)),(P(29),P(31)),(P(43),P(37))],fill=mid,outline=dark); d.polygon([(P(85),P(18)),(P(110),P(2)),(P(99),P(31)),(P(85),P(37))],fill=mid,outline=dark)
  elif v==2: d.pieslice((P(36),P(-12),P(92),P(46)),180,360,fill=dark,outline=gold,width=w)
  else:
   for x in (35,45,55,65,75,85): d.line((P(x),P(12),P(x+rng.randint(-10,10)),P(0)),fill=gold,width=w)
  d.rounded_rectangle((P(31),P(88),P(97),P(98)),radius=P(3),fill=dark,outline=gold,width=w); d.polygon([(P(64),P(84)),(P(72),P(93)),(P(64),P(102)),(P(56),P(93))],fill=gold,outline=dark)
  d.polygon([(P(39),P(98)),(P(61),P(98)),(P(58),P(116)),(P(34),P(116))],fill=shadow,outline=dark); d.polygon([(P(67),P(98)),(P(89),P(98)),(P(94),P(116)),(P(70),P(116))],fill=shadow,outline=dark)
  d.rounded_rectangle((P(29),P(111),P(60),P(122)),radius=P(3),fill=dark,outline=gold,width=w); d.rounded_rectangle((P(68),P(111),P(99),P(122)),radius=P(3),fill=dark,outline=gold,width=w)
  if fam in ("characters","bosses") or seed%2==0: d.line((P(109),P(40),P(116),P(108)),fill=dark,width=P(7)); d.line((P(109),P(40),P(116),P(108)),fill=gold,width=P(3)); d.polygon([(P(103),P(39)),(P(109),P(14)),(P(115),P(39))],fill=light,outline=dark)
  for _ in range(24): d.point((rng.randint(P(32),P(96)),rng.randint(P(56),P(89))),fill=gold)
 elif fam in ("weapons","armor","items"):
  d.ellipse((P(18),P(108),P(110),P(121)),fill=(5,8,15,95))
  if fam=="weapons": d.line((P(27),P(101),P(95),P(22)),fill=dark,width=P(13)); d.line((P(29),P(97),P(93),P(23)),fill=gold,width=P(5)); d.polygon([(P(82),P(34)),(P(94),P(7)),(P(101),P(31)),(P(96),P(45))],fill=light,outline=dark); d.line((P(19),P(84),P(50),P(109)),fill=mid,width=P(8)); d.line((P(11),P(78),P(35),P(101)),fill=gold,width=P(4))
  elif fam=="armor": d.polygon([(P(31),P(20)),(P(49),P(10)),(P(78),P(10)),(P(98),P(23)),(P(119),P(50)),(P(99),P(68)),(P(89),P(55)),(P(91),P(108)),(P(35),P(108)),(P(37),P(55)),(P(27),P(68)),(P(8),P(50))],fill=mid,outline=dark); d.polygon([(P(48),P(22)),(P(64),P(34)),(P(80),P(22)),(P(88),P(56)),(P(64),P(73)),(P(40),P(56))],fill=light,outline=shadow); d.line((P(47),P(82),P(82),P(82)),fill=gold,width=P(4))
  else: d.rounded_rectangle((P(35),P(27),P(93),P(107)),radius=P(12),fill=mid,outline=gold,width=w); d.rectangle((P(45),P(17),P(83),P(32)),fill=light,outline=dark,width=w); d.ellipse((P(44),P(43),P(84),P(83)),fill=gold,outline=light,width=w); d.ellipse((P(54),P(53),P(74),P(73)),fill=light)
 elif fam in ("terrain","buildings","dungeons"):
  d.rectangle((P(4),P(4),P(124),P(124)),fill=dark,outline=gold,width=w); d.rectangle((P(8),P(8),P(120),P(120)),fill=mid)
  d.polygon([(P(8),P(77)),(P(33),P(38)),(P(53),P(72)),(P(78),P(30)),(P(120),P(79)),(P(120),P(120)),(P(8),P(120))],fill=shadow); d.polygon([(P(8),P(88)),(P(42),P(65)),(P(63),P(86)),(P(91),P(62)),(P(120),P(90)),(P(120),P(120)),(P(8),P(120))],fill=light)
  if fam!="terrain": d.rectangle((P(39),P(49),P(91),P(111)),fill=dark,outline=gold,width=w); d.polygon([(P(32),P(53)),(P(65),P(20)),(P(99),P(53))],fill=mid,outline=gold); [d.rectangle((P(x),P(63),P(x+12),P(78)),fill=gold,outline=dark) for x in (48,77)]; d.rectangle((P(57),P(84),P(73),P(111)),fill=shadow,outline=gold)
  else: [d.point((rng.randint(P(9),P(118)),rng.randint(P(83),P(118))),fill=gold) for _ in range(50)]
 elif fam=="effects":
  [d.ellipse((P(64-r),P(64-r),P(64+r),P(64+r)),outline=gold,width=w) for r in (44,31,18)]
  for a in range(0,360,30):
   x1=P(64)+int(P(17)*math.cos(math.radians(a))); y1=P(64)+int(P(17)*math.sin(math.radians(a))); x2=P(64)+int(P(53)*math.cos(math.radians(a))); y2=P(64)+int(P(53)*math.sin(math.radians(a))); d.line((x1,y1,x2,y2),fill=light,width=w)
  d.ellipse((P(52),P(52),P(76),P(76)),fill=(255,255,245,255),outline=gold,width=w)
 else: d.rounded_rectangle((P(5),P(5),P(123),P(123)),radius=P(12),fill=dark,outline=gold,width=w); d.rounded_rectangle((P(10),P(10),P(118),P(118)),radius=P(9),fill=mid,outline=light,width=w); d.polygon([(P(64),P(20)),(P(94),P(64)),(P(64),P(108)),(P(34),P(64))],fill=light,outline=gold); d.ellipse((P(52),P(52),P(76),P(76)),fill=gold)
 return im
def write_asset(im,path):
 path.parent.mkdir(parents=True,exist_ok=True); im.save(path,"PNG",optimize=True)
 try:
  import numpy as np
  Image.fromarray(__import__("numpy").asarray(im,dtype="uint16")*257,mode="RGBA;16B").save(path.with_suffix(".tiff"),compression="tiff_deflate")
 except Exception: pass
def main():
 ap=argparse.ArgumentParser(); ap.add_argument("--size",type=int,choices=(128,256,512,1024),default=256); args=ap.parse_args(); entries=[]; previews=[]
 for fam,names in FAMILIES.items():
  for i,name in enumerate(names,1):
   aid=f"GBQ-HD64-{fam.upper()}-{i:03d}"; im=art(fam,name,args.size,seedof(aid+"|v2")); path=OUT/"png"/fam/f"{name}_{args.size}.png"; write_asset(im,path)
   th=im.copy(); th.thumbnail((128,128),Image.Resampling.LANCZOS); previews.append((fam,name,th)); entries.append({"asset_id":aid,"family":fam,"subject":name,"png":str(path.relative_to(ROOT)),"tiff":str(path.with_suffix(".tiff").relative_to(ROOT)),"width":args.size,"height":args.size,"channels":"RGBA","original":True})
 OUT.mkdir(parents=True,exist_ok=True); cell=160; cols=6; rows=math.ceil(len(previews)/cols); sheet=Image.new("RGBA",(cols*cell,rows*cell),(17,22,34,255)); draw=ImageDraw.Draw(sheet)
 for i,(fam,name,im) in enumerate(previews):
  x=(i%cols)*cell; y=(i//cols)*cell; sheet.alpha_composite(im,(x+16,y+4)); draw.text((x+7,y+137),f"{fam}: {name}",fill=(240,232,214,255))
 sheet.convert("RGB").save(OUT/"contact-sheet.jpg",quality=92); (OUT/"manifest.json").write_text(json.dumps({"version":2,"asset_count":len(entries),"size":args.size,"legacy_preserved":True,"assets":entries},indent=2),encoding="utf-8")
 (OUT/"README.md").write_text("# HD64 v2 Art Library\n\nCompanion high-detail fantasy art. Classic Game Boy and current HD64 assets are untouched. Run `python tools/gen_hd64_v2.py --size 256` (or 512/1024). PNGs are RGBA; optional TIFF 16-bit/channel masters are written when codec support permits. Original procedural concept art; detailed animation sets and key art require dedicated production passes.\n",encoding="utf-8")
 print("Generated",len(entries),"original HD64 assets at",args.size,"px")
if __name__=="__main__": main()