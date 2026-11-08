#!/usr/bin/env python3
"""Validate and ZIP an already-generated GB-Quest HD64 6,000-image pack."""
from __future__ import annotations
import argparse
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PACK = ROOT / "assets_hd64" / "gbq_6000"

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_PACK,
                        help="generated pack directory")
    parser.add_argument("--output", type=Path,
                        default=ROOT / "build" / "GB-Quest-6000-HD64-Assets.zip")
    args = parser.parse_args()
    pack = args.root.resolve()
    if not pack.is_dir():
        parser.error(f"asset pack does not exist: {pack}; run npm run assets:generate:6000 first")
    validator = ROOT / "tools" / "validate_pack6000_hd.py"
    subprocess.run([sys.executable, str(validator), "--root", str(pack)], cwd=ROOT, check=True)
    files = sorted(p for p in pack.rglob("*") if p.is_file())
    if not files:
        parser.error(f"asset pack is empty: {pack}")
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in files:
            archive.write(path, Path("gbq_6000") / path.relative_to(pack))
    print(f"Created {output} ({len(files):,} files)")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
