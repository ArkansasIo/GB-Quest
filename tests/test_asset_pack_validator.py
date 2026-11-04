#!/usr/bin/env python3
"""Regression tests for the read-only HD64 asset pack validator."""
from __future__ import annotations

import csv
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = ROOT / "tools" / "validate_pack6000_hd.py"


class AssetPackValidatorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="gbq-assets-")
        self.root = Path(self.temp.name) / "pack"
        (self.root / "metadata").mkdir(parents=True)
        (self.root / "assets").mkdir()
        self.records = []

    def tearDown(self):
        self.temp.cleanup()

    def add_image(self, asset_id: str, filename: str, color=(30, 80, 120, 255), compress=6):
        path = self.root / "assets" / filename
        Image.new("RGBA", (64, 64), color).save(path, format="PNG", compress_level=compress)
        self.records.append({
            "asset_id": asset_id,
            "category": "weapons",
            "path": f"assets/{filename}",
            "format": "PNG",
            "width": 64,
            "height": 64,
            "alpha": True,
            "status": "TEST",
        })

    def write_manifests(self):
        (self.root / "metadata" / "asset_manifest.json").write_text(
            json.dumps(self.records), encoding="utf-8"
        )
        with (self.root / "metadata" / "asset_manifest.csv").open(
            "w", newline="", encoding="utf-8"
        ) as handle:
            fields = list(dict.fromkeys(
                field for record in self.records for field in record
            ))
            writer = csv.DictWriter(handle, fieldnames=fields)
            writer.writeheader()
            writer.writerows(self.records)

    def run_validator(self, *extra):
        return subprocess.run(
            [sys.executable, str(VALIDATOR), "--root", str(self.root), "--allow-partial", *extra],
            text=True, capture_output=True, check=False,
        )

    def test_accepts_matching_partial_pack(self):
        self.add_image("GBQ-0001", "one.png")
        self.write_manifests()
        result = self.run_validator()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("1 unique assets", result.stdout)

    def test_accepts_blank_optional_csv_metadata_column(self):
        self.add_image("GBQ-0001", "one.png")
        self.add_image("GBQ-0002", "two.png")
        self.records[0]["family"] = "undead"
        self.write_manifests()
        result = self.run_validator()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_rejects_csv_metadata_drift_even_when_ids_match(self):
        self.add_image("GBQ-0001", "one.png")
        self.write_manifests()
        csv_path = self.root / "metadata" / "asset_manifest.csv"
        csv_path.write_text(csv_path.read_text().replace("assets/one.png", "assets/missing.png"), encoding="utf-8")
        result = self.run_validator()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("path:", result.stdout)

    def test_rejects_visually_identical_pngs_with_different_compression(self):
        self.add_image("GBQ-0001", "one.png", compress=0)
        self.add_image("GBQ-0002", "two.png", compress=9)
        self.write_manifests()
        self.assertNotEqual(
            (self.root / "assets" / "one.png").read_bytes(),
            (self.root / "assets" / "two.png").read_bytes(),
            "test fixtures must have different PNG encodings",
        )
        result = self.run_validator()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("duplicate PNG contents", result.stdout)

    def test_rejects_symlink_escape_from_pack_root(self):
        outside = Path(self.temp.name) / "outside.png"
        Image.new("RGBA", (64, 64), (1, 2, 3, 255)).save(outside)
        link = self.root / "assets" / "escape.png"
        try:
            link.symlink_to(outside)
        except (OSError, NotImplementedError):
            self.skipTest("symlinks are not available on this platform")
        self.records.append({
            "asset_id": "GBQ-0001", "category": "weapons", "path": "assets/escape.png",
        })
        self.write_manifests()
        result = self.run_validator()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("escapes pack root", result.stdout)


if __name__ == "__main__":
    unittest.main()
