import json
import tempfile
import unittest
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.audit_pack6000 import audit


class AssetPackAuditTests(unittest.TestCase):
    def make_pack(self, root: Path, duplicate: bool = False) -> None:
        (root / "metadata").mkdir()
        (root / "assets" / "sample").mkdir(parents=True)
        (root / "metadata" / "category_summary.json").write_text(
            json.dumps([{"category": "sample", "count": 2}]), encoding="utf-8"
        )
        rows = []
        for index in range(1, 3):
            name = f"{index:04d}.png"
            path = root / "assets" / "sample" / name
            color = (index, 0, 80, 255)
            if duplicate and index == 2:
                color = (1, 0, 80, 255)
            Image.new("RGBA", (64, 64), color).save(path)
            rows.append({
                "asset_id": f"GBQ-{index:04d}", "category": "sample",
                "category_index": index, "path": f"assets/sample/{name}",
                "width": 64, "height": 64
            })
        (root / "metadata" / "asset_manifest.json").write_text(json.dumps(rows), encoding="utf-8")

    def test_valid_pack_passes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_pack(root)
            result = audit(root, expected_total=2)
            self.assertTrue(result["ok"], result["errors"])
            self.assertEqual(result["checked_images"], 2)

    def test_missing_asset_is_reported(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_pack(root)
            (root / "assets/sample/0001.png").unlink()
            result = audit(root, expected_total=2)
            self.assertFalse(result["ok"])
            self.assertTrue(any("missing file" in error for error in result["errors"]))

    def test_identical_assets_are_reported_as_warning_by_default(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_pack(root, duplicate=True)
            result = audit(root, expected_total=2)
            self.assertTrue(result["ok"], result["errors"])
            self.assertEqual(result["duplicate_groups"], 1)
            self.assertTrue(result["warnings"])


if __name__ == "__main__":
    unittest.main()
