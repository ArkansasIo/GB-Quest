#!/usr/bin/env python3
"""Compatibility entry point for the canonical GB Quest build.

The Node builder owns the ordered runtime bundle, classic handheld theme,
HD64/Citadel artwork embedding, player HUD integration, and standalone HTML
output. Keep this Python command as a stable entry point for existing docs and
scripts, but delegate final assembly to tools/build.cjs so both build paths
cannot silently drift apart.
"""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> int:
    # The atlas builder exports live game data and writes dist/atlas.html,
    # which the canonical HTML builder embeds into the standalone game.
    run([sys.executable, str(ROOT / "tools" / "build_atlas.py")])
    node = os.environ.get("NODE", "node")
    run([node, str(ROOT / "tools" / "build.cjs")])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
