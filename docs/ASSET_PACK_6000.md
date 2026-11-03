# GB-Quest 6,000 Asset Pack

The repository already has an original art pipeline and HD atlas system. This pack is
generated into a separate directory to avoid overwriting existing game assets.

## Generate locally

    python -m pip install Pillow
    python tools/generate_6000_asset_pack.py

Output:
- assets_hd64/gbq_6000/assets/<category>/ — 6,000 individual 64x64 RGBA PNGs
- assets_hd64/gbq_6000/atlases/ — 18 preview atlases and JSON metadata
- assets_hd64/gbq_6000/metadata/ — CSV and JSON manifests
- GB-Quest-6000-Full-Assets.zip — distributable archive

For a non-destructive high-resolution remaster of all 6,000 assets, see [HD 6,000 Asset Remaster](HD_6000_ASSET_REMASTER.md) and run the **Build 6,000 Asset HD Remaster** GitHub Actions workflow. The assets are deterministic procedural pixel-art starter images. They are not
individually hand-painted final art, full animation sequences, or automatically wired
into gameplay. Review and curate before production use. Existing atlas loaders remain
unchanged.
