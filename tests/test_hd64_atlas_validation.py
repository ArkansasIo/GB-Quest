import json
import struct
import tempfile
import unittest
from pathlib import Path

from tools.validate_hd64_atlases import png_size, validate_atlases


def write_png_header(path, width, height):
    path.write_bytes(
        b"\\x89PNG\\r\\n\\x1a\\n"
        + struct.pack(">I", 13)
        + b"IHDR"
        + struct.pack(">II", width, height)
        + bytes([8, 6, 0, 0, 0])
        + struct.pack(">I", 0)
    )


class HD64AtlasValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def write_manifest(self, data):
        (self.root / "class_sheets.json").write_text(json.dumps(data), encoding="utf-8")
        write_png_header(self.root / "class_sheets_0.png", 256, 128)

    def test_accepts_valid_rectangles_and_reads_png_dimensions(self):
        self.write_manifest({"c_warrior_0": [0, 2, 3, 64, 96]})
        self.assertEqual(png_size(self.root / "class_sheets_0.png"), (256, 128))
        total, errors, summaries = validate_atlases(self.root)
        self.assertEqual(total, 1)
        self.assertEqual(errors, [])
        self.assertEqual(summaries, [("class_sheets.json", 1, 1)])

    def test_rejects_rectangles_outside_page_bounds(self):
        self.write_manifest({"c_warrior_0": [0, 220, 3, 64, 96]})
        total, errors, _ = validate_atlases(self.root)
        self.assertEqual(total, 0)
        self.assertTrue(any("exceeds 256x128" in error for error in errors))

    def test_rejects_missing_page_and_invalid_rectangle(self):
        (self.root / "class_sheets.json").write_text(json.dumps({
            "missing": [1, 0, 0, 16, 16],
            "bad": [0, -1, 0, 16, 16]
        }), encoding="utf-8")
        write_png_header(self.root / "class_sheets_0.png", 64, 64)
        _, errors, _ = validate_atlases(self.root)
        self.assertTrue(any("missing atlas page" in error for error in errors))
        self.assertTrue(any("invalid negative/zero" in error for error in errors))

    def test_rejects_malformed_rectangles(self):
        self.write_manifest({"bad": [0, 1, 2, "wide", 4]})
        _, errors, _ = validate_atlases(self.root)
        self.assertTrue(any("must be integers" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
