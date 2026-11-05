#!/usr/bin/env python3
"""Regression tests for the legacy HD64 atlas image enhancer."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import gen_hd64  # noqa: E402


class HD64EnhancerTests(unittest.TestCase):
    def test_outline_does_not_wrap_across_opposite_sprite_edges(self):
        pixels = np.zeros((8, 8, 4), dtype=np.uint8)
        pixels[0, 0] = (220, 90, 40, 255)
        result = gen_hd64.enhance(Image.fromarray(pixels, "RGBA"))
        alpha = np.asarray(result)[:, :, 3]
        self.assertEqual(result.size, (32, 32))
        self.assertEqual(int(alpha[-1, 0]), 0, "top-edge silhouette leaked to bottom edge")
        self.assertEqual(int(alpha[0, -1]), 0, "left-edge silhouette leaked to right edge")

    def test_enhancer_preserves_transparent_background(self):
        pixels = np.zeros((8, 8, 4), dtype=np.uint8)
        result = gen_hd64.enhance(Image.fromarray(pixels, "RGBA"))
        alpha = np.asarray(result)[:, :, 3]
        self.assertTrue(np.all(alpha == 0))


if __name__ == "__main__":
    unittest.main()
