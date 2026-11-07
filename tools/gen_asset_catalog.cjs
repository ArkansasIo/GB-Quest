#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const sort = values => values.sort((a, b) => a.localeCompare(b));
const groupBy = (values, keyOf) => {
  const groups = new Map();
  for (const value of values) {
    const key = keyOf(value);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(value);
  }
  return groups;
};
const section = (title, groups, render = value => value) => {
  const output = [`## ${title}`, ''];
  for (const key of sort([...groups.keys()])) {
    const values = sort(groups.get(key));
    output.push(`### ${key} (${values.length})`, '', '```text', ...values.map(render), '```', '');
  }
  return output;
};

const pngNames = sort(readJson('assets/index.json'));
const pngGroups = groupBy(pngNames, name => name.match(/^[a-z]+/)?.[0] || 'other');
const nesIndex = readJson('assets/nes_index.json');
const nesGroups = groupBy(Object.entries(nesIndex).flatMap(([family, names]) => names.map(name => `${family}\t${name}`)), value => value.split('\t')[0]);

const hd64Groups = new Map();
for (const file of fs.readdirSync(path.join(root, 'assets_hd64')).filter(name => name.endsWith('.json')).sort()) {
  const family = path.basename(file, '.json');
  hd64Groups.set(family, Object.keys(readJson(path.join('assets_hd64', file))));
}

const categorySingular = {
  races: 'race', classes: 'class', creatures: 'creature', bosses: 'boss', environments: 'environment',
  props: 'prop', terrain: 'terrain', buildings: 'building', roads: 'road', weapons: 'weapon',
  armor: 'armor', shields: 'shield', ui: 'ui',
};
const citadelFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.svg')) {
      const relative = path.relative(path.join(root, 'assets_citadel'), full).split(path.sep).join('/');
      const [category, ...rest] = relative.split('/');
      const id = rest.at(-1).replace(/\.svg$/i, '');
      const key = `citadel_${categorySingular[category] || category}_${id}`;
      citadelFiles.push(`${key}\tassets_citadel/${relative}`);
    }
  }
}
walk(path.join(root, 'assets_citadel'));
const citadelGroups = groupBy(citadelFiles, value => value.split('\t')[0].match(/^citadel_([^_]+)/)?.[1] || 'other');

const hd64Count = [...hd64Groups.values()].reduce((sum, names) => sum + names.length, 0);
const nesCount = [...nesGroups.values()].reduce((sum, names) => sum + names.length, 0);
const lines = [
  '# In-Game Asset Names', '',
  'This inventory lists the named image assets the game loads, including the optional HD64 atlases and Citadel vector art.', '',
  '## Sources and counts', '',
  `- **Runtime PNG IDs:** ${pngNames.length} names in \`assets/index.json\`. Each name maps to \`assets/<name>.png\`.`,
  `- **Classic sprite aliases:** ${nesCount} sprite IDs across ${nesGroups.size} groups in \`assets/nes_index.json\`; aliases point at runtime PNG IDs.`,
  `- **HD64 atlas IDs:** ${hd64Count} sprite IDs across ${hd64Groups.size} atlases in \`assets_hd64/*.json\`.`,
  `- **Citadel vector IDs:** ${citadelFiles.length} SVG assets, loaded as \`citadel_*\` IDs from \`assets_citadel/\`.`, '',
  'This is an identifier inventory, not a list of every crop rectangle inside a sprite sheet. IDs are grouped by their runtime family or atlas.', '',
  ...section('Runtime PNG IDs', pngGroups),
  ...section('Classic Sprite Aliases', nesGroups, value => value.split('\t').at(-1)),
  ...section('HD64 Atlas Sprite IDs', hd64Groups),
  ...section('Citadel Vector IDs', citadelGroups, value => value.replace('\t', ' — ')),
  '## Regenerate', '',
  'After changing the runtime indexes or Citadel SVG files, run:', '',
  '```sh', 'node tools/gen_asset_catalog.cjs', '```', '',
].flat();

const output = path.join(root, 'docs', 'IN_GAME_ASSET_NAMES.md');
fs.writeFileSync(output, lines.join('\n'));
console.log(`Wrote ${path.relative(root, output)} (${pngNames.length} PNG IDs, ${hd64Count} HD64 IDs, ${citadelFiles.length} Citadel vectors).`);
