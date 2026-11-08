const fs = require('fs');

const tilesPath = 'C:/Users/Shadow/Videos/New folder/Lost-Kingdoms-of-ShadowBane/assets_hd64/tiles.json';

try {
    const data = JSON.parse(fs.readFileSync(tilesPath, 'utf8'));
    const tileNames = Object.keys(data);
    
    console.log('Total tiles found:', tileNames.length);
    console.log('\nFirst 10 tiles:');
    
    for (let i = 0; i < Math.min(10, tileNames.length); i++) {
        console.log(`${i + 1}. ${tileNames[i]}`);
    }
} catch (error) {
    console.error('Error:', error.message);
}
