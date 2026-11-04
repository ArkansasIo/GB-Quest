import csv
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "tools" / "validate_cinematic_asset_briefs.py"
SPEC = importlib.util.spec_from_file_location("validate_cinematic_asset_briefs", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

FIELDS = [
    "asset_id", "category", "sequence", "variation_seed", "asset_name",
    "asset_type", "target_engine", "resolution", "maps", "prompt",
    "negative_prompt", "source_filename", "status",
]


class CinematicBriefValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.budget = self.root / "budget.json"
        self.csv_path = self.root / "briefs.csv"
        self.budget.write_text(json.dumps({
            "total_assets": 2,
            "categories": [{"id": "weapons", "count": 2}],
        }), encoding="utf-8")
        self.rows = [
            {
                "asset_id": f"GBQ-CIN-{i:04d}",
                "category": "weapons",
                "sequence": str(i),
                "variation_seed": str(100 + i),
                "asset_name": f"Weapon {i}",
                "asset_type": "image_or_model_brief",
                "target_engine": "Unreal Engine 5.7",
                "resolution": "2048x2048 minimum",
                "maps": "BaseColor;Normal;ORM",
                "prompt": f"Original weapon design {i}",
                "negative_prompt": "pixel art, watermark",
                "source_filename": f"GBQ-CIN-{i:04d}",
                "status": "brief_ready_source_art_not_generated",
            }
            for i in (1, 2)
        ]
        self.write_rows()

    def tearDown(self):
        self.temp.cleanup()

    def write_rows(self):
        with self.csv_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=FIELDS)
            writer.writeheader()
            writer.writerows(self.rows)

    def test_accepts_complete_unique_brief_set(self):
        result = MODULE.validate(self.budget, self.csv_path)
        self.assertTrue(result["valid"], result["errors"])
        self.assertEqual(result["actual_briefs"], 2)
        self.assertFalse(result["rendered_assets_verified"])

    def test_rejects_duplicate_variation_seed(self):
        self.rows[1]["variation_seed"] = self.rows[0]["variation_seed"]
        self.write_rows()
        result = MODULE.validate(self.budget, self.csv_path)
        self.assertFalse(result["valid"])
        self.assertTrue(any("Duplicate variation_seed" in error for error in result["errors"]))

    def test_rejects_category_count_mismatch(self):
        self.rows.pop()
        self.write_rows()
        result = MODULE.validate(self.budget, self.csv_path)
        self.assertFalse(result["valid"])
        self.assertTrue(any("expected 2 briefs; found 1" in error for error in result["errors"]))


if __name__ == "__main__":
    unittest.main()
