#!/usr/bin/env python3
"""Build a source-inclusive itch.io release archive.

The archive contains the playable single-file HTML5 build plus the complete
project source, tests, build tooling, documentation, and runtime assets.
Generated caches, dependencies, private server state, and excluded licensed
third-party source packs are intentionally omitted.
"""
from __future__ import annotations
import hashlib
import os
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
PLAYABLE = BUILD / "gbquest-itch-html5.zip"
OUTPUT = BUILD / "gbquest-itch-full-source.zip"
EXCLUDED_DIRS = {
    ".git", ".github-cache", "node_modules", "__pycache__", ".pytest_cache",
    ".mypy_cache", ".ruff_cache", ".venv", "venv", "build", "release",
    "coverage", ".next", ".turbo",
}
EXCLUDED_PREFIXES = ("server/data/", "assets_hd64/gbq_6000/", "assets_hd64/gbq_6000_hd/")
EXCLUDED_NAMES = {".DS_Store", "Thumbs.db"}
EXCLUDED_SUFFIXES = {".pyc", ".pyo", ".log", ".tmp", ".bak"}

PACKAGE_README = """# GB Quest — itch.io Full Source Package

This archive includes:
- itch-build/index.html: self-contained playable HTML5 build for itch.io.
- source/: project source, JavaScript systems, client UI, native C++ core,
  Java edition, Electron desktop launcher, backend, tests, tools, documentation,
  workflows, and runtime assets.
- SOURCE-MANIFEST.sha256: SHA-256 checksums for packaged source files.

## Run the browser game
Upload itch-build/index.html as a ZIP configured as an HTML project on itch.io.
For local testing, extract the ZIP and open itch-build/index.html in a modern
browser. The standalone build embeds its required runtime assets.

## Rebuild from source
Install Node.js 24+ and Python 3, then run:
    npm ci
    npm run build:itch

The browser build is generated at build/gbquest-itch-html5.zip.
Native C++ and Java builds have their own project instructions in README.md
and their respective directories. Desktop packaging requires the platform's
native build environment.

Third-party dependency caches, private server runtime data, and excluded
licensed source asset packs are not redistributed. Install dependencies using
the lockfile and each component's documented build instructions.
"""

def excluded(path: Path) -> bool:
    rel = path.relative_to(ROOT).as_posix()
    parts = path.relative_to(ROOT).parts
    if any(part in EXCLUDED_DIRS for part in parts):
        return True
    if parts[:2] == ("art_source", "packs"):
        return True
    if any(rel.startswith(prefix) for prefix in EXCLUDED_PREFIXES):
        return True
    if path.name in EXCLUDED_NAMES or path.suffix.lower() in EXCLUDED_SUFFIXES:
        return True
    return False

def main() -> None:
    if not PLAYABLE.is_file():
        raise SystemExit(f"Missing playable build: {PLAYABLE}. Run npm run build:itch first.")
    BUILD.mkdir(parents=True, exist_ok=True)
    if OUTPUT.exists():
        OUTPUT.unlink()
    entries = []
    for current, dirnames, filenames in os.walk(ROOT):
        current_path = Path(current)
        kept_dirs = []
        for dirname in dirnames:
            candidate = current_path / dirname
            if not excluded(candidate / "__directory_marker__"):
                kept_dirs.append(dirname)
        dirnames[:] = sorted(kept_dirs)
        for filename in sorted(filenames):
            path = current_path / filename
            if excluded(path):
                continue
            rel = path.relative_to(ROOT).as_posix()
            entries.append((path, f"source/{rel}"))
    entries.sort(key=lambda item: item[1])
    with zipfile.ZipFile(PLAYABLE) as playable_zip:
        playable_html = playable_zip.read("index.html")
    digest_lines = []
    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=8) as archive:
        archive.writestr("itch-build/index.html", playable_html)
        archive.writestr("README-ITCH-SOURCE.md", PACKAGE_README)
        for path, arcname in entries:
            data = path.read_bytes()
            archive.writestr(arcname, data)
            digest_lines.append(f"{hashlib.sha256(data).hexdigest()}  {arcname}")
        archive.writestr("SOURCE-MANIFEST.sha256", "\n".join(digest_lines) + "\n")
    with zipfile.ZipFile(OUTPUT) as archive:
        bad = archive.testzip()
        if bad:
            raise SystemExit(f"ZIP integrity check failed at {bad}")
        names = archive.namelist()
        required = ["itch-build/index.html"]
        required_prefixes = ["source/src/", "source/native/", "source/tests/"]
        if any(name not in names for name in required):
            raise SystemExit("Playable HTML entry is missing.")
        for prefix in required_prefixes:
            if not any(name.startswith(prefix) for name in names):
                raise SystemExit(f"Required source directory is missing: {prefix}")
    print(f"Created {OUTPUT} ({OUTPUT.stat().st_size / 1024 / 1024:.2f} MiB)")
    print(f"Included {len(entries)} source/project files plus playable HTML5 build.")
    print("ZIP integrity and required source directories verified.")

if __name__ == "__main__":
    main()
