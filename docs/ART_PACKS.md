# Pixel packs (third-party art)

SETTINGS > ART cycles **CLASSIC**, **NES** and **PIXEL PACKS** (the default). PIXEL PACKS redraws the game with six pixel-art packs:

| Pack | Used for |
|---|---|
| MiniWorldSprites | trees, pines, forests, rocks for 8 biomes; houses, inns, shops, temples in towns (coloured per biome); 18 townsfolk roles as walkers (guards, soldiers, mages, farmers...); dragons, demons, orcs, goblins, pirates, frostborn, slimes, undead |
| 2D Pixel Dungeon Asset Pack v2.0 | the DUNGEON theme's floor, walls, doors, bars, ladders, torches, braziers, bones, coins, crates, banners; skeletons, vampire, ghoul, mummy, outlaws, cultists, wisp |
| Assets (weapon/armour tiers) | 11 tiers each of swords, daggers, axes, maces, bows, shields, armour, helmets and boots (one tier per rarity step) |
| rpg_icon_pack | rings, magic gems, wands, keys, coins, spellbooks |
| Farm Sim Asset Pack | polearms, crossbows, staves and 14 potions |
| Enemy Animations Set | same monsters as the dungeon pack (not used separately) |

About a third of each matching monster family's subtypes use pack monsters (stable per subtype), plus half the dragon, fiend, undead and giant bosses. Beasts, plants and other families keep their art.

## Rebuilding

The original pack files live in `art_source/packs/` (git-ignored). Unpack each pack there, then:

```bash
python3 tools/gen_packs.py      # writes assets/pk_*.png and src/pack_index.js
python3 tools/gen_hd64.py       # 64-bit atlases (pixel_packs_*)
node tools/build.cjs
```

## Licences and credits

The packs are third-party art used under their creators' licences. The licence included with one pack allows personal and commercial use and forbids reselling the art as an asset pack; check each pack's itch.io page for its own terms. The raw packs are not committed. Only the converted game sprites (`assets/pk_*`) are, because the build embeds them. Credits are appreciated by the authors: MiniWorldSprites, 2D Pixel Dungeon Asset Pack (Pixel_Poem), RPG icon pack, Farm Sim Asset Pack (admurin), weapon and armour tier icons, Enemy Animations Set.
