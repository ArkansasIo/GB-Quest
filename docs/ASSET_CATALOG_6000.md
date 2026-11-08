# GB Quest — 6,144-image Aelmoor catalog

Run from the repository root:

```bash
python3 tools/generate_6000_assets.py
```

The default run writes **6,144 individual transparent PNG files** (16 asset families × 384 images) under `assets/generated_catalog/<family>/` and creates `assets/generated_catalog/manifest.json`.

Families: terrain, flora, buildings, props, characters, monsters, bosses, weapons, armor, items, icons, effects, UI, mounts, portraits and dungeon tiles.

To generate 8,000 images, run `python3 tools/generate_6000_assets.py --count-per-family 500`. Use `--seed` for a deterministic alternate set and `--output` to choose a different asset directory.

The generator uses only the Python standard library. It preserves stable asset IDs, transparent backgrounds, 16/24/32-pixel native dimensions and nearest-neighbour pixel-art styling. Generated files are build outputs; the source generator and manifest schema are tracked in Git so the repository does not need thousands of binary blobs committed. These are original procedural starter assets, not final hand-painted art.

The separate 17-file concept pack documented at `artwork/itchio-full-version/README.md` remains a reference package. Its concept crops still need to be sliced and reviewed as production sprite sheets before they can be mapped to final runtime IDs.
