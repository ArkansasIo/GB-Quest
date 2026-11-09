# Generated 8-bit art gallery integration

The main menu now includes **ART GALLERY**, backed by `src/art_gallery.js`. The gallery expects these PNGs in `assets/`:

- `gbq_asset_sheet_01.png`
- `gbq_asset_sheet_02.png`
- `gbq_asset_sheet_03.png`

Install them by extracting the companion `GB-Quest-8bit-Art-Pack.zip` at the repository root. The existing `tools/build.cjs` asset scan automatically includes PNGs in `assets/` and regenerates `assets/index.json` during the normal build. Then build and open the game; choose **ART GALLERY** from the main menu and use left/right to browse.

These generated images are reference boards, not individual transparent animation frames. They are displayed in the gallery; existing sliced runtime sprites remain responsible for live characters, items, terrain, and combat rendering. This avoids treating a labeled concept sheet as a production sprite atlas.
