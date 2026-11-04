# GB-Quest 6,000 Asset Pack (HD64)

6,000 original 64x64 RGBA pixel-art PNGs in 18 categories, drawn by a procedural renderer in the style of
hand-shaded 64-bit-era sprites: height-field shapes lit from the top-left, hue-shifted palette ramps with
ordered dithering, seams where parts tuck under each other, rock materials cut into pillowed chunks with
glowing cracks (the stone-golem look), emissive eyes, runes and cores with a soft halo, and dark outlines.

## Generate locally

    python -m pip install numpy Pillow
    python tools/gen_pack6000_hd.py                       # about 20 seconds
    python tools/gen_pack6000_hd.py --zip GB-Quest-6000-HD64-Assets.zip
    python tools/gen_pack6000_hd.py --only monsters_creatures --limit 50

`node tools/export_godot.cjs` runs the generator automatically when the pack is missing.

Output (gitignored, rebuilt on demand):
- `assets_hd64/gbq_6000/assets/<category>/` - the 6,000 PNGs
- `assets_hd64/gbq_6000/atlases/` - 18 preview sheets and JSON
- `assets_hd64/gbq_6000/metadata/` - CSV and JSON manifests (asset ids GBQ-0001..GBQ-6000; monsters and bosses carry a `family`)

## 64-bit masters and HD sizes

The HD remaster pipeline ([HD 6,000 Asset Remaster](HD_6000_ASSET_REMASTER.md)) takes this pack as its source and
writes 128-1024 px PNGs plus true RGBA 16-bit-per-channel (64 bits per pixel) TIFF masters:

    python tools/gen_pack6000_hd.py --output assets_hd64/gbq_6000
    python tools/remaster_6000_asset_pack.py --source assets_hd64/gbq_6000 --output assets_hd64/gbq_6000_hd --size 256

or run the **Build 6,000 Asset HD Remaster** GitHub Actions workflow (its `generator` input picks `hd64`, this
generator, or `starter`, the original one).

## Categories

| Category | Count | What the generator draws |
|---|---|---|
| player_races_characters | 500 | the 15 races (ears, horns, tusks, tails, wings, halos) with outfits and weapons |
| classes_subclasses | 300 | the 27 classes with their armour type and signature weapon / off-hand |
| weapons | 600 | 15 weapon types (swords to tridents), metals, grips, gems, rune glows |
| armor_clothing | 600 | chest, helm, boots, gloves, shield, cloak, pants, pauldrons; plate or cloth |
| jewelry_accessories | 250 | rings, amulets, crowns, earrings, bracelets, cut gems |
| monsters_creatures | 700 | 50 per bestiary family: golems with glowing cracks, slimes, beasts, skeletons, ghosts, elementals, spiders, fiends, fey, dragons, serpents, eye beasts, tentacles, treants, flower beasts, giants, humanoids, celestials |
| bosses_raid_creatures | 250 | larger family monsters with an aura |
| environments_tilesets | 700 | 14 tileable 64x64 terrains (grass to roof tiles), water and lava glow |
| buildings_settlements | 300 | houses with lit windows, towers, temples, tents, walls and gates |
| maps_worlds | 150 | island and parchment world maps with towns |
| dungeons_towers_raids | 250 | doors, stairs, pillars, altars, chests, sarcophagi, braziers, portcullises, statues, spike traps |
| magic_visual_effects | 250 | orbs, bursts, rune circles, slashes, beams, sparkles, swirls, shields |
| items_consumables | 350 | potions, scrolls, food, herbs, ores, keys, books, bags, coins, eggs and bombs |
| mounts_pets | 150 | saddled steeds, wolves, lizards, griffins, slimes, small pets |
| npcs_civilians | 200 | townsfolk with aprons, tools and instruments |
| ui_interface | 200 | slots, buttons, hearts, stars, gears, skulls, bars, cursors, badges, crests |
| factions_quests_achievements | 150 | banners, heraldic shields, medals, trophies, sealed quest scrolls |
| promotional_loading_art | 100 | dusk scenes with mountains, a moon, a castle and a lone hero |

Generation is deterministic (the same asset ID produces the same pixels). The generator uses distinct per-ID seeds, but visual uniqueness is not assumed: the audit reports byte-identical PNGs so collisions can be reviewed.

## Validate a generated pack

After a complete generation (not a `--only` or `--limit` run), validate the manifest and every PNG:

```bash
python tools/audit_pack6000.py --root assets_hd64/gbq_6000 --json-out assets_hd64/gbq_6000/metadata/audit-report.json
python tests/test_asset_pack_audit.py
```

The audit checks all 6,000 sequential IDs, category totals, category/index uniqueness, safe manifest paths, file existence, PNG decoding, 64×64 dimensions, RGBA mode, and byte-identical image groups. Duplicate image content is a warning by default; use `--strict-duplicates` to fail on duplicates. The audit is read-only and does not rewrite assets or manifests.

A dedicated **Audit HD64 6,000 Asset Pack** GitHub Actions workflow regenerates the pack, runs this audit and the focused unit tests, then uploads the ZIP and JSON report.

## In the Summer port

`tools/export_godot.cjs` packs the pack into 24 atlases (`summer-prototype/art/hd6000_*.png`), names each
picture `hd_<category>_<NNNN>` in `data/sprites.json`, and writes `data/pack6000.json` (by category and by
monster family). SETTINGS > MONSTER ART (HD64, the default) shows every monster and boss as a pack picture of
its own family; SETTINGS > ART GALLERY browses all 6,000.

These are generated assets, not hand-painted final art; review before shipping. The older starter generator,
tools/generate_6000_asset_pack.py, is kept; this generator uses the same layout and asset ids.
