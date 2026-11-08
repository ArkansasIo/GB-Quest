import fs from 'fs';

const tileConfig = {
  "layers": [
    ["gt_road_01", "gt_road_02", "gt_road_03"],
    ["gt_tree_01", "gt_tree_02", "gt_bush_01", "gt_bush_02"],
    ["gt_farm_01", "gt_farm_02"]
  ]
};

const outputFileName = 'tiles.json';
const tiles = {};

let layerIdx = 0;
tileConfig.layers.forEach(layer => {
  const layerTiles = {};
  let tileIdx = 0;
  
  layer.forEach(tileFilename => {
    const tileKey = tileFilename;
    const tileValue = `https://raw.githubusercontent.com/eforgacs-games/Dragon_Warrior/main/data/images/${tileFilename}`;
    
    tiles[tileKey] = tileValue;
  });
  
  tiles[`layer_${layerIdx}_tiles`] = layerTiles;
  layerIdx++;
});

fs.writeFileSync(outputFileName, JSON.stringify(tiles, null, 2));

console.log(`${outputFileName} created successfully with ${Object.keys(tiles).length} tiles.`);
