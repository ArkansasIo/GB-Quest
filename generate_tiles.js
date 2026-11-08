const fs = require('fs');
const path = require('path');

const tilesPath = path.join(__dirname, '..', 'assets_hd64', 'tiles.json');

try {
    const data = JSON.parse(fs.readFileSync(tilesPath, 'utf8'));
    console.log('Total tiles found:', Object.keys(data).length);
    
    // Extract all tile names with their GitHub raw URLs
    const result = {};
    for (const [tileName, meta] of Object.entries(data)) {
        const url = `https://raw.githubusercontent.com/eforgacs-games/Dragon_Warrior/main/data/images/${tileName}`;
        result[tileName] = [url];
    }
    
    fs.writeFileSync(tilesPath, JSON.stringify(result, null, 2));
    console.log('tiles.json updated with GitHub raw URLs');
} catch (error) {
    console.error('Error:', error.message);
}
