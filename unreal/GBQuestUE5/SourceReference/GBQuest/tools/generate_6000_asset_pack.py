#!/usr/bin/env python3
"""Generate 6,000 deterministic original pixel-art starter PNGs for GB-Quest."""
import argparse, csv, hashlib, json, math, random, zipfile
from pathlib import Path
from PIL import Image, ImageDraw

CATEGORIES = [
("player_races_characters",500),("classes_subclasses",300),("weapons",600),
("armor_clothing",600),("jewelry_accessories",250),("monsters_creatures",700),
("bosses_raid_creatures",250),("environments_tilesets",700),("buildings_settlements",300),
("maps_worlds",150),("dungeons_towers_raids",250),("magic_visual_effects",250),
("items_consumables",350),("mounts_pets",150),("npcs_civilians",200),
("ui_interface",200),("factions_quests_achievements",150),("promotional_loading_art",100)]
PALETTES=[
((23,29,55),(52,73,116),(87,139,184),(173,218,232),(244,221,160)),
((42,24,35),(112,39,52),(184,70,62),(239,143,83),(255,218,153)),
((25,47,39),(43,102,70),(91,158,91),(173,204,113),(231,228,167)),
((39,29,63),(88,56,132),(139,91,192),(203,151,229),(244,214,255)),
((38,39,45),(91,98,109),(151,161,174),(208,211,208),(250,232,185)),
((55,34,22),(113,65,37),(171,105,48),(222,159,76),(249,220,145)),
((18,48,64),(25,107,130),(45,169,177),(119,221,207),(220,255,236)),
((58,23,58),(132,39,113),(205,67,136),(246,128,161),(255,213,205))]

def make_image(category,index,asset_id):
    seed=int(hashlib.sha256(asset_id.encode()).hexdigest()[:12],16)
    rng=random.Random(seed); dark,mid,main,light,shine=PALETTES[(index+seed)%len(PALETTES)]
    im=Image.new("RGBA",(64,64),(0,0,0,0)); d=ImageDraw.Draw(im)
    actors={"player_races_characters","classes_subclasses","monsters_creatures","bosses_raid_creatures","mounts_pets","npcs_civilians"}
    scenes={"environments_tilesets","buildings_settlements","maps_worlds","dungeons_towers_raids","promotional_loading_art"}
    if category in actors:
        d.ellipse((12,53,52,60),fill=(0,0,0,105))
        d.rectangle((19,39,29,54),fill=dark); d.rectangle((34,39,45,54),fill=dark)
        d.polygon([(20,21),(44,21),(49,42),(15,42)],fill=main,outline=dark)
        d.rectangle((23,25,41,38),fill=mid)
        d.line((19,25,11,41),fill=dark,width=7); d.line((45,25,53,40),fill=dark,width=7)
        d.ellipse((20,5,44,28),fill=dark); d.ellipse((22,7,42,26),fill=main)
        d.rectangle((24,13,40,18),fill=light); d.point((28,15),fill=dark); d.point((36,15),fill=dark)
        if index%3==0: d.polygon([(22,12),(17,2),(26,8),(31,1),(38,8),(46,2),(42,16)],fill=shine,outline=dark)
        elif index%3==1: d.polygon([(22,10),(18,0),(27,7),(38,7),(46,0),(42,14)],fill=dark)
        else: d.polygon([(21,9),(25,2),(39,2),(44,11)],fill=light)
        d.rectangle((19,36,45,40),fill=shine)
        if index%4:
            x=8 if index%2 else 55
            d.line((x,17,x,47),fill=shine,width=3); d.line((x-4,24,x+4,24),fill=light,width=2)
    elif category in scenes:
        d.rectangle((3,3,60,60),fill=dark,outline=shine,width=2)
        for _ in range(18):
            x,y=rng.randint(5,58),rng.randint(5,58)
            d.rectangle((x,y,x+rng.randint(2,7),y+rng.randint(2,5)),fill=rng.choice((mid,main,light)))
        d.rectangle((5,39,58,57),fill=mid)
        d.polygon([(5,40),(15,rng.randint(16,30)),(24,39),(35,rng.randint(12,29)),(45,39),(58,20),(58,57),(5,57)],fill=main,outline=dark)
        if category in {"buildings_settlements","dungeons_towers_raids"}:
            d.rectangle((21,21,44,53),fill=light,outline=dark,width=2)
            d.polygon([(18,23),(32,9),(47,23)],fill=main,outline=dark)
            d.rectangle((28,39,37,53),fill=dark)
            d.rectangle((24,28,29,34),fill=shine); d.rectangle((37,28,42,34),fill=shine)
        else: d.ellipse((42,8,52,18),fill=shine)
    elif category in {"weapons","armor_clothing","jewelry_accessories"}:
        if category=="weapons":
            x=rng.randint(25,37); d.line((x,8,32,48),fill=dark,width=9); d.line((x,8,32,48),fill=main,width=5)
            d.polygon([(x-5,12),(x,3),(x+7,12),(x+1,39)],fill=light,outline=dark)
            d.line((19,37,45,31),fill=shine,width=4); d.rectangle((27,45,37,53),fill=mid,outline=dark)
        elif category=="armor_clothing":
            d.polygon([(19,12),(27,7),(37,7),(45,13),(54,23),(45,31),(42,25),(42,53),(22,53),(22,25),(17,31),(10,23)],fill=main,outline=dark)
            d.line((27,11,32,20,38,11),fill=shine,width=3); d.rectangle((23,36,41,40),fill=light)
        else:
            d.ellipse((12,15,52,53),outline=shine,width=7); d.ellipse((22,25,42,43),fill=main,outline=dark,width=2)
            d.polygon([(32,6),(38,19),(32,26),(25,18)],fill=light,outline=dark)
    elif category=="magic_visual_effects":
        for radius in (24,17,10):
            d.ellipse((32-radius,32-radius,32+radius,32+radius),outline=main if radius==24 else light,width=2)
        for angle in range(0,360,45):
            x1=32+int(10*math.cos(math.radians(angle))); y1=32+int(10*math.sin(math.radians(angle)))
            x2=32+int(27*math.cos(math.radians(angle))); y2=32+int(27*math.sin(math.radians(angle)))
            d.line((x1,y1,x2,y2),fill=light,width=3)
        d.ellipse((25,25,39,39),fill=shine,outline=light)
    else:
        d.rounded_rectangle((8,8,56,56),radius=8,fill=dark,outline=shine,width=2)
        if index%4==0: d.ellipse((18,16,46,48),fill=main,outline=light,width=3)
        elif index%4==1: d.polygon([(32,10),(49,27),(32,50),(15,27)],fill=main,outline=light)
        elif index%4==2: d.polygon([(17,18),(47,18),(43,46),(21,46)],fill=main,outline=light)
        else: d.ellipse((16,16,48,48),fill=main,outline=light,width=3)
        d.line((22,32,42,32),fill=shine,width=3)
    for _ in range(5):
        x=rng.choice((rng.randint(5,14),rng.randint(49,58))); y=rng.randint(5,58); d.point((x,y),fill=shine)
    return im

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--output",default="assets_hd64/gbq_6000")
    ap.add_argument("--zip",default="GB-Quest-6000-Full-Assets.zip")
    args=ap.parse_args(); out=Path(args.output); atlas_dir=out/"atlases"; atlas_dir.mkdir(parents=True,exist_ok=True)
    rows=[]; gid=1
    for category,count in CATEGORIES:
        folder=out/"assets"/category; folder.mkdir(parents=True,exist_ok=True); previews=[]
        for i in range(1,count+1):
            aid=f"GBQ-{gid:04d}"; name=f"{i:04d}_{category}.png"
            image=make_image(category,i,aid); image.save(folder/name,optimize=True)
            if i<=100: previews.append(image)
            rows.append({"asset_id":aid,"category":category,"category_index":i,"filename":name,
                         "path":f"assets/{category}/{name}","format":"PNG","width":64,"height":64,
                         "alpha":True,"status":"GENERATED_PROCEDURAL_PIXEL_ART"})
            gid+=1
        sheet=Image.new("RGBA",(640,640),(18,22,34,255))
        for j,image in enumerate(previews): sheet.alpha_composite(image,((j%10)*64,(j//10)*64))
        sheet.save(atlas_dir/f"{category}_preview.png",optimize=True)
        (atlas_dir/f"{category}.json").write_text(json.dumps({"category":category,"total_assets":count,
          "preview_count":len(previews),"preview_file":f"{category}_preview.png","cell_size":[64,64],
          "columns":10},indent=2),encoding="utf-8")
    meta=out/"metadata"; meta.mkdir(exist_ok=True)
    with (meta/"asset_manifest.csv").open("w",newline="",encoding="utf-8") as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    (meta/"asset_manifest.json").write_text(json.dumps(rows,indent=2),encoding="utf-8")
    (meta/"category_summary.json").write_text(json.dumps([{"category":c,"count":n} for c,n in CATEGORIES],indent=2),encoding="utf-8")
    (out/"README.md").write_text("# GB-Quest 6,000 Asset Pack\n\n6,000 individual 64x64 RGBA procedural pixel-art starter PNGs in 18 categories. Includes 18 preview atlases and CSV/JSON manifests. These are generated base assets, not hand-painted final art or complete animation sets.\n",encoding="utf-8")
    zpath=Path(args.zip); zpath.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(zpath,"w",zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in out.rglob("*"):
            if p.is_file(): z.write(p,p.relative_to(out.parent))
    print(f"Generated {len(rows)} PNG assets across {len(CATEGORIES)} categories.")

if __name__=="__main__": main()
