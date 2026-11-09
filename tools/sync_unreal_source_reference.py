#!/usr/bin/env python3
"""Refresh unreal/GBQuestUE5/SourceReference/GBQuest, the Unreal port's mirror of the game source.

Uses the same rules as unreal/GBQuestUE5/create_blueprints.py (source/text extensions only, no images, the same
excluded folders) but runs without Unreal and copies only files tracked by git. Files that are no longer tracked
are removed from the mirror, so it never keeps stale copies (an old backend/ that its own tests no longer match).

    python tools/sync_unreal_source_reference.py          # sync
    python tools/sync_unreal_source_reference.py --check  # exit 1 if the mirror is out of date
"""
import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIRROR = ROOT / 'unreal' / 'GBQuestUE5' / 'SourceReference' / 'GBQuest'
SOURCE_EXTENSIONS = {'.c', '.cc', '.cjs', '.cpp', '.cs', '.css', '.gd', '.h', '.hpp', '.html', '.ini', '.js', '.json', '.md', '.mjs',
                     '.py', '.ps1', '.sh', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml'}
EXCLUDED_DIRS = {'.agents', '.aws', '.codex', '.git', '.github', '.vscode', 'build', 'dist', 'node_modules', 'unreal'}


def wanted():
    out = subprocess.run(['git', 'ls-files', '-z'], cwd=ROOT, check=True, capture_output=True).stdout.decode('utf8').split('\0')
    for rel in out:
        if not rel:
            continue
        parts = Path(rel).parts
        if any(p.lower() in EXCLUDED_DIRS for p in parts[:-1]) or Path(rel).suffix.lower() not in SOURCE_EXTENSIONS:
            continue
        yield rel


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    files = set(wanted())
    stale = []
    for rel in sorted(files):
        src, dst = ROOT / rel, MIRROR / rel
        if not dst.is_file() or src.read_bytes() != dst.read_bytes():
            stale.append(rel)
            if not a.check:
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(src, dst)
    extra = [str(p.relative_to(MIRROR)).replace(os.sep, '/') for p in MIRROR.rglob('*') if p.is_file()
             and str(p.relative_to(MIRROR)).replace(os.sep, '/') not in files]
    if not a.check:
        for rel in extra:
            (MIRROR / rel).unlink()
        for d in sorted((p for p in MIRROR.rglob('*') if p.is_dir()), key=lambda p: len(p.parts), reverse=True):
            if not any(d.iterdir()):
                d.rmdir()
    print(f'{len(files)} source files; {len(stale)} {"out of date" if a.check else "updated"}; {len(extra)} {"extra" if a.check else "removed"}')
    if a.check and (stale or extra):
        sys.exit(1)


if __name__ == '__main__':
    main()
