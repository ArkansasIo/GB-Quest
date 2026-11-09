import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let embeddedNames = null;

function bundledNames() {
  if (embeddedNames) return embeddedNames;
  embeddedNames = new Set();
  const file = path.join(root, 'dist/gbquest.html');
  if (!fs.existsSync(file)) return embeddedNames;
  const html = fs.readFileSync(file, 'utf8');
  const start = html.indexOf('window.GB_ASSETS=');
  if (start < 0) return embeddedNames;
  const end = html.indexOf(';</script>', start);
  const re = /"([^"\\]+)":"data:image\/png;base64,/g;
  re.lastIndex = start;
  let match;
  while ((match = re.exec(html)) && (end < 0 || match.index < end)) embeddedNames.add(match[1]);
  return embeddedNames;
}

export function runtimeAssetNames() {
  const catalog = path.join(root, 'assets/index.json');
  if (fs.existsSync(catalog)) {
    const names = JSON.parse(fs.readFileSync(catalog, 'utf8'));
    if (Array.isArray(names) && names.length) return new Set(names);
  }
  return bundledNames();
}

export function hasRuntimeAsset(name) {
  if (fs.existsSync(path.join(root, 'assets', `${name}.png`))) return true;
  return bundledNames().has(name);
}
