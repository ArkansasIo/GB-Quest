'use strict';
// GB-Quest replacement-art registry.
// Entries point at the clean category atlases produced from the six supplied sheets.
// Atlas panels are preview/staging assets; individual animation-ready sprites are
// intentionally not substituted until they have transparent bounds and frame metadata.
const GOTHIC_ART_PACK = Object.freeze({
  version: '1.0.0',
  status: 'staging',
  categories: Object.freeze({
    characters: { atlas: 'assets_gothic/characters-monsters-atlas.png', runtime: 'characters', frameReady: false },
    monsters: { atlas: 'assets_gothic/characters-monsters-atlas.png', runtime: 'bestiary', frameReady: false },
    weapons: { atlas: 'assets_gothic/weapons-armor-atlas.png', runtime: 'equipment', frameReady: false },
    armor: { atlas: 'assets_gothic/weapons-armor-atlas.png', runtime: 'equipment', frameReady: false },
    skills: { atlas: 'assets_gothic/skills-abilities-atlas.png', runtime: 'skills', frameReady: false },
    biomes: { atlas: 'assets_gothic/biomes-atlas.png', runtime: 'overworld', frameReady: false },
    dungeons: { atlas: 'assets_gothic/dungeon-interiors-atlas.png', runtime: 'dungeons', frameReady: false },
    items: { atlas: 'assets_gothic/catalog-items-monsters-atlas.png', runtime: 'inventory', frameReady: false },
    world: { atlas: 'assets_gothic/catalog-world-blocks-atlas.png', runtime: 'world', frameReady: false },
    ui: { atlas: 'assets_gothic/ui-components-atlas.png', runtime: 'interface', frameReady: false },
    gothicUi: { atlas: 'assets_gothic/gothic-ui-kit-atlas.png', runtime: 'interface', frameReady: false },
    expansion: { atlas: 'assets_gothic/expansion-gear-biomes-atlas.png', runtime: 'equipment-world', frameReady: false }
  }),
  sourceSheets: Object.freeze([
    'assets_gothic/asset-sheet-v1-2.png',
    'assets_gothic/gothic-4-color-ui-kit.png',
    'assets_gothic/great-catalog-v2.png',
    'assets_gothic/master-atlas-v3-expansion.png',
    'assets_gothic/master-developer-mockup.png',
    'assets_gothic/sprite-sheet-collection-v1-5.png'
  ])
});

if (typeof module !== 'undefined' && module.exports) module.exports = GOTHIC_ART_PACK;
if (typeof globalThis !== 'undefined') globalThis.GBQGothicArtPack = GOTHIC_ART_PACK;
