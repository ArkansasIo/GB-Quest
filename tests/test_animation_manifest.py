import tempfile
import unittest
from pathlib import Path

from tools.build_animation_manifest import ANIMATIONS, ARCHETYPES, DIRECTIONS, RANKS, build_rows, validate


def write_png(path, width=128, height=128):
    import struct
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + struct.pack(">I", 13) + b"IHDR"
        + struct.pack(">II", width, height)
        + bytes([8, 6, 0, 0, 0]) + struct.pack(">I", 0)
    )


class AnimationManifestTests(unittest.TestCase):
    def test_manifest_defines_full_archetype_rank_direction_matrix(self):
        with tempfile.TemporaryDirectory() as tmp:
            rows = build_rows(Path(tmp) / "frames", 128)
        self.assertEqual(len(rows), len(ARCHETYPES) * len(RANKS) * len(DIRECTIONS) * len(ANIMATIONS))
        self.assertEqual(len(rows), 3456)
        self.assertEqual(sum(row["frame_count"] for row in rows), 22032)
        self.assertTrue(all(row["status"] == "planned" for row in rows))
        self.assertTrue(all(row["frame_width"] == row["frame_height"] == 128 for row in rows))

    def test_validation_reports_missing_frames_without_creating_art(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "frames"
            rows = build_rows(root, 128)
            errors = validate(rows[:1])
            self.assertEqual(len(errors), 1)
            self.assertEqual(len(errors[0]["missing_frames"]), ANIMATIONS["idle"][0])
            self.assertFalse(root.exists())

    def test_validation_accepts_complete_authored_sequence(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "frames"
            rows = build_rows(root, 128)
            row = rows[0]
            folder = Path(row["folder"])
            for index in range(row["frame_count"]):
                write_png(folder / row["filename_pattern"].format(index=index))
            self.assertEqual(validate([row]), [])

    def test_validation_detects_incomplete_sequence(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "frames"
            row = build_rows(root, 128)[0]
            folder = Path(row["folder"])
            write_png(folder / row["filename_pattern"].format(index=0))
            errors = validate([row])
            self.assertEqual(len(errors), 1)
            self.assertEqual(len(errors[0]["missing_frames"]), row["frame_count"] - 1)


if __name__ == "__main__":
    unittest.main()
