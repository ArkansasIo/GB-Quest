#!/usr/bin/env python3
"""Create a non-destructive HD remaster of the 6,000-source GB-Quest asset pack.

The source generator remains authoritative. This tool enlarges and grades each source
image, exports 8-bit RGBA PNG delivery files, and writes true uint16 RGBA TIFF masters.
It does not invent hand-painted detail or replace source sprites.
"""
import argparse, csv, json, math
from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import tifffile

ROOT=Path(__file__).resolve().parents[1]
DEFAULT_SOURCE=ROOT/"assets_hd64"/"gbq_6000"
DEFAULT_OUTPUT=ROOT/"assets_hd64"/"gbq_6000_hd"

def remaster(src: Image.Image, size: int) -> Image.Image:
    src=src.convert("RGBA")
    # Preserve crisp source silhouettes while giving larger artwork a clean edge.
    rgb=src.convert("RGB").resize((size,size),Image.Resampling.LANCZOS)
    rgb=ImageEnhance.Color(rgb).enhance(1.10)
    rgb=ImageEnhance.Contrast(rgb).enhance(1.06)
    rgb=ImageEnhance.Sharpness(rgb).enhance(1.25)
    rgb=rgb.filter(ImageFilter.UnsharpMask(radius=max(1,size//128),percent=115,threshold=3))
    alpha=src.getchannel("A").resize((size,size),Image.Resampling.NEAREST)
    out=rgb.convert("RGBA"); out.putalpha(alpha)
    return out

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--source",type=Path,default=DEFAULT_SOURCE)
    ap.add_argument("--output",type=Path,default=DEFAULT_OUTPUT)
    ap.add_argument("--size",type=int,choices=(128,256,512,1024),default=256)
    ap.add_argument("--no-tiff",action="store_true")
    args=ap.parse_args()
    manifest_path=args.source/"metadata"/"asset_manifest.json"
    if not manifest_path.is_file(): raise SystemExit(f"Missing source manifest: {manifest_path}. Run tools/generate_6000_asset_pack.py first.")
    rows=json.loads(manifest_path.read_text(encoding="utf-8"))
    out_rows=[]; previews={}; expected=0
    for row in rows:
        src=args.source/row["path"]
        if not src.is_file(): raise FileNotFoundError(src)
        with Image.open(src) as image: hd=remaster(image,args.size)
        rel=Path(row["path"]).with_suffix(".png")
        png=args.output/"assets"/rel; png.parent.mkdir(parents=True,exist_ok=True)
        hd.save(png,"PNG",optimize=True)
        tiff_rel=Path(row["path"]).with_suffix(".tiff")
        if not args.no_tiff:
            # Expand 8-bit values to the full 16-bit range, retaining alpha.
            rgba=np.asarray(hd,dtype=np.uint16)*257
            tiff=args.output/"masters_16bit"/tiff_rel; tiff.parent.mkdir(parents=True,exist_ok=True)
            tifffile.imwrite(tiff,rgba,photometric="rgb",extrasamples="unassalpha",compression="deflate")
        item=dict(row); item.update({"source_path":row["path"],"path":str(Path("assets")/rel),"format":"PNG","width":args.size,"height":args.size,"channels":"RGBA","bits_per_channel":8,"remaster_method":"LANCZOS+colour-grade+unsharp-mask","not_hand_painted":True})
        if not args.no_tiff: item["master_16bit_path"]=str(Path("masters_16bit")/tiff_rel); item["master_bits_per_channel"]=16
        out_rows.append(item); expected+=1
        category=row["category"]
        if category not in previews: previews[category]=[]
        if len(previews[category])<100: previews[category].append(hd.copy())
    meta=args.output/"metadata"; meta.mkdir(parents=True,exist_ok=True)
    (meta/"asset_manifest.json").write_text(json.dumps(out_rows,indent=2),encoding="utf-8")
    with (meta/"asset_manifest.csv").open("w",newline="",encoding="utf-8") as f:
        w=csv.DictWriter(f,fieldnames=list(out_rows[0])); w.writeheader(); w.writerows(out_rows)
    atlas_dir=args.output/"atlases"; atlas_dir.mkdir(parents=True,exist_ok=True)
    for category,images in previews.items():
        cell=128; sheet=Image.new("RGBA",(10*cell,10*cell),(17,22,34,255))
        for i,image in enumerate(images):
            thumb=image.copy(); thumb.thumbnail((cell,cell),Image.Resampling.LANCZOS)
            sheet.alpha_composite(thumb,((i%10)*cell,(i//10)*cell))
        sheet.save(atlas_dir/f"{category}_preview.png",optimize=True)
    report={"asset_count":expected,"render_size":args.size,"png":{"format":"RGBA PNG","bits_per_channel":8,"bits_per_pixel":32},"tiff_master":None if args.no_tiff else {"format":"RGBA TIFF","bits_per_channel":16,"bits_per_pixel":64},"source_pack":str(args.source.relative_to(ROOT)) if args.source.is_relative_to(ROOT) else str(args.source),"source_preserved":True,"art_note":"Upscaled and graded remasters of procedural source sprites; not newly hand-painted detail."}
    (args.output/"remaster_report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    (args.output/"README.md").write_text("# GB-Quest HD Remaster of the 6,000 Asset Pack\\n\\nNon-destructive enlargement and colour/edge grading of the original procedural sprites. Source assets are preserved. PNGs are RGBA 8-bit/channel (32 bpp); optional TIFF masters are RGBA 16-bit/channel (64 bpp). Upscaling does not create hand-painted detail. See `remaster_report.json` and `metadata/asset_manifest.json`.\\n",encoding="utf-8")
    print(f"Remastered {expected} assets at {args.size}px; source pack unchanged.")

if __name__=="__main__": main()