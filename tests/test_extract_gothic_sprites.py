import json
import subprocess
import sys
from pathlib import Path

def test_extracts_skill_and_equipment_icon_cells(tmp_path):
    root = Path(__file__).resolve().parents[1]
    sources = root / "assets_gothic" / "staging"
    if not (sources / "skills-abilities-atlas.png").exists():
        import pytest
        pytest.skip("Staged binary art pack is not checked into this checkout")
    output = tmp_path / "sprites"
    subprocess.run([sys.executable, str(root / "tools" / "extract_gothic_sprites.py"),
                    "--source-dir", str(sources), "--output-dir", str(output)], check=True)
    manifest = json.loads((output / "sprite-manifest.json").read_text())
    assert len(manifest["groups"]["skills"]) == 24
    assert len(manifest["groups"]["equipment"]) == 32
    assert manifest["totalSprites"] == 56
    assert all((output / item["file"]).is_file()
               for group in manifest["groups"].values() for item in group)
