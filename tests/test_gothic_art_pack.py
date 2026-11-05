import json, subprocess, sys, tempfile, zipfile
from pathlib import Path
from PIL import Image
def test_staging_installer(tmp_path):
    root=Path(__file__).resolve().parents[1]
    archive=Path("GB-Quest-Dark-Fantasy-Replacement-Art-Pack.zip")
    if not archive.exists():
        import pytest; pytest.skip("Replacement art ZIP is not checked into repository")
    out=tmp_path/"stage"
    subprocess.run([sys.executable,str(root/"tools/install_gothic_art_pack.py"),str(archive),"--output",str(out)],check=True)
    manifest=json.loads((out/"asset-manifest.json").read_text())
    assert manifest["runtimeSwapEnabled"] is False
    assert len(manifest["atlases"]) >= 9
    for item in manifest["atlases"]:
        with Image.open(out/item["file"]) as im: im.verify()
